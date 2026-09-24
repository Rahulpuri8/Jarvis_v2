/**
 * ResourceMonitor — Centralized RAM/CPU monitoring with hysteresis.
 *
 * Replaces scattered inline RAM checks in:
 *   - ipc.ts (line 1093)
 *   - command-runner.service.ts (line 39)
 *   - workflow-engine.service.ts (line 118)
 *
 * Hysteresis prevents flapping:
 *   Throttle ON  at 85% RAM usage
 *   Throttle OFF at 75% RAM usage
 *
 * Usage (Electron main process):
 *   import { resourceMonitor } from './services/resource-monitor';
 *   if (resourceMonitor.shouldThrottle()) { await delay(1500); }
 *
 * Also emits events for subscribers:
 *   resourceMonitor.on('throttle-start', () => { ... });
 *   resourceMonitor.on('throttle-end', () => { ... });
 */

import { EventEmitter } from 'node:events';
import * as os from 'node:os';

export interface ResourceMonitorConfig {
  /** RAM percentage to START throttling (default: 85) */
  throttleOnPercent: number;
  /** RAM percentage to STOP throttling (default: 75) */
  throttleOffPercent: number;
  /** Delay in ms when throttled (default: 1500) */
  throttleDelayMs: number;
  /** Polling interval in ms for background monitoring (default: 5000) */
  pollIntervalMs: number;
}

export interface ResourceSnapshot {
  ramPercent: number;
  ramUsedGb: number;
  ramTotalGb: number;
  cpuCount: number;
  isThrottled: boolean;
  timestamp: number;
}

const DEFAULT_CONFIG: ResourceMonitorConfig = {
  throttleOnPercent: 85,
  throttleOffPercent: 75,
  throttleDelayMs: 1500,
  pollIntervalMs: 5000,
};

export class ResourceMonitor extends EventEmitter {
  private config: ResourceMonitorConfig;
  private _isThrottled = false;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _lastSnapshot: ResourceSnapshot | null = null;

  constructor(config?: Partial<ResourceMonitorConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Get current RAM usage percentage */
  getRamPercent(): number {
    const total = os.totalmem();
    const free = os.freemem();
    return Math.round(((total - free) / total) * 100);
  }

  /** Take a full resource snapshot */
  getSnapshot(): ResourceSnapshot {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const snap: ResourceSnapshot = {
      ramPercent: Math.round((used / total) * 100),
      ramUsedGb: Math.round((used / (1024 ** 3)) * 10) / 10,
      ramTotalGb: Math.round((total / (1024 ** 3)) * 10) / 10,
      cpuCount: os.cpus().length,
      isThrottled: this._isThrottled,
      timestamp: Date.now(),
    };
    this._lastSnapshot = snap;
    return snap;
  }

  /**
   * Check if execution should be throttled.
   * Uses hysteresis: once throttled, stays throttled until RAM drops below offPercent.
   */
  shouldThrottle(): boolean {
    const pct = this.getRamPercent();
    const wasThrottled = this._isThrottled;

    if (!this._isThrottled && pct >= this.config.throttleOnPercent) {
      this._isThrottled = true;
      this.emit('throttle-start', pct);
    } else if (this._isThrottled && pct <= this.config.throttleOffPercent) {
      this._isThrottled = false;
      this.emit('throttle-end', pct);
    }

    return this._isThrottled;
  }

  /**
   * Apply throttle delay if RAM pressure is high.
   * Drop-in replacement for the scattered inline checks.
   */
  async applyThrottle(): Promise<void> {
    if (this.shouldThrottle()) {
      await new Promise((resolve) => setTimeout(resolve, this.config.throttleDelayMs));
    }
  }

  /** Current throttle state (without re-checking) */
  get isThrottled(): boolean {
    return this._isThrottled;
  }

  /** Last taken snapshot (may be null if never polled) */
  get lastSnapshot(): ResourceSnapshot | null {
    return this._lastSnapshot;
  }

  /** Start background polling (emits 'snapshot' events) */
  startPolling(): void {
    if (this._pollTimer) return;
    this._pollTimer = setInterval(() => {
      const snap = this.getSnapshot();
      this.shouldThrottle(); // update hysteresis state
      this.emit('snapshot', snap);
    }, this.config.pollIntervalMs);
  }

  /** Stop background polling */
  stopPolling(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  /** Get current config */
  getConfig(): ResourceMonitorConfig {
    return { ...this.config };
  }
}

// Singleton for use across Electron main process
export const resourceMonitor = new ResourceMonitor();
