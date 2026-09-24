import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import WebSocket from 'ws';
import type { ToolDefinition, ToolRequest, ToolResult, RuntimeStatus } from '../../../../packages/shared/types';

export class PythonRuntimeService {
  private process: ChildProcess | null = null;
  private ws: WebSocket | null = null;
  private port = 9321;
  private baseUrl = `http://127.0.0.1:${this.port}`;
  private wsUrl = `ws://127.0.0.1:${this.port}/ws`;
  private pendingRequests = new Map<string, { resolve: (res: ToolResult) => void; reject: (err: Error) => void; timeout: NodeJS.Timeout }>();
  private isShuttingDown = false;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  private resolvePythonPath(): string {
    // 1. Check local virtual environment inside runtime/
    const venvPythonWin = path.join(this.projectRoot, 'runtime', '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPythonWin)) {
      return venvPythonWin;
    }

    const venvPythonPosix = path.join(this.projectRoot, 'runtime', '.venv', 'bin', 'python');
    if (fs.existsSync(venvPythonPosix)) {
      return venvPythonPosix;
    }

    // 2. Check root .venv
    const rootVenvWin = path.join(this.projectRoot, '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(rootVenvWin)) {
      return rootVenvWin;
    }

    // 3. Fallback to system python
    return 'python';
  }

  public async start(): Promise<boolean> {
    if (this.process) {
      return true;
    }

    // First check if server is already running
    const isHealthy = await this.checkHealth();
    if (isHealthy) {
      console.log('[PythonRuntimeService] Server already active on port', this.port);
      this.initWebSocket();
      return true;
    }

    const pythonPath = this.resolvePythonPath();
    console.log('[PythonRuntimeService] Launching Python runtime with:', pythonPath);

    this.process = spawn(pythonPath, ['-m', 'runtime.main'], {
      cwd: this.projectRoot,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONPATH: this.projectRoot,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.process.stdout?.on('data', (data) => {
      console.log(`[Python Runtime] ${data.toString().trim()}`);
    });

    this.process.stderr?.on('data', (data) => {
      console.warn(`[Python Runtime Error] ${data.toString().trim()}`);
    });

    this.process.on('exit', (code, signal) => {
      console.log(`[PythonRuntimeService] Process exited with code ${code}, signal ${signal}`);
      this.process = null;
      if (!this.isShuttingDown) {
        // Attempt restart after unexpected exit
        setTimeout(() => this.start(), 3000);
      }
    });

    // Wait for server to become responsive
    const ready = await this.waitForHealth(15000);
    if (ready) {
      this.initWebSocket();
      return true;
    }

    console.error('[PythonRuntimeService] Failed to initialize runtime within timeout');
    return false;
  }

  public stop(): void {
    this.isShuttingDown = true;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    if (this.process) {
      console.log('[PythonRuntimeService] Terminating Python process');
      try {
        this.process.kill('SIGTERM');
      } catch {
        this.process.kill('SIGKILL');
      }
      this.process = null;
    }
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }

  private async waitForHealth(timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (await this.checkHealth()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
  }

  private initWebSocket(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log('[PythonRuntimeService] WebSocket connected');
      });

      this.ws.on('message', (raw) => {
        try {
          const result = JSON.parse(raw.toString()) as ToolResult;
          const pending = this.pendingRequests.get(result.request_id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(result.request_id);
            pending.resolve(result);
          }
        } catch (err) {
          console.error('[PythonRuntimeService] Error parsing WebSocket message:', err);
        }
      });

      this.ws.on('close', () => {
        console.log('[PythonRuntimeService] WebSocket disconnected');
        this.ws = null;
        if (!this.isShuttingDown) {
          setTimeout(() => this.initWebSocket(), 2000);
        }
      });

      this.ws.on('error', (err) => {
        console.warn('[PythonRuntimeService] WebSocket error:', err.message);
      });
    } catch (e) {
      console.error('[PythonRuntimeService] Error initiating WebSocket:', e);
    }
  }

  public async getStatus(): Promise<RuntimeStatus> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (res.ok) {
        const data = (await res.json()) as any;
        return {
          online: true,
          status: data.status || 'healthy',
          total_tools: data.total_tools || 0,
          categories: data.categories || [],
          uptime_seconds: data.uptime_seconds,
        };
      }
    } catch (e: any) {
      return {
        online: false,
        status: 'offline',
        total_tools: 0,
        categories: [],
        error: e.message,
      };
    }

    return {
      online: false,
      status: 'offline',
      total_tools: 0,
      categories: [],
    };
  }

  public async listTools(category?: string): Promise<ToolDefinition[]> {
    try {
      const url = category ? `${this.baseUrl}/tools?category=${encodeURIComponent(category)}` : `${this.baseUrl}/tools`;
      const res = await fetch(url);
      if (res.ok) {
        return (await res.json()) as ToolDefinition[];
      }
    } catch (e) {
      console.error('[PythonRuntimeService] Failed to fetch tools list:', e);
    }
    return [];
  }

  public async executeTool(request: ToolRequest): Promise<ToolResult> {
    const requestId = request.request_id || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fullRequest = { ...request, request_id: requestId };

    // Prefer WebSocket if active
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return new Promise<ToolResult>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          resolve({
            success: false,
            status: 'failed',
            message: `Tool execution timed out after 35s`,
            error: 'TimeoutError',
            request_id: requestId,
          });
        }, 35000);

        this.pendingRequests.set(requestId, { resolve, reject, timeout });
        this.ws!.send(JSON.stringify(fullRequest));
      });
    }

    // Fallback to HTTP POST
    try {
      const res = await fetch(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullRequest),
      });

      if (res.ok) {
        return (await res.json()) as ToolResult;
      }

      const text = await res.text();
      return {
        success: false,
        status: 'failed',
        message: `HTTP execution error: ${res.statusText}`,
        error: text,
        request_id: requestId,
      };
    } catch (e: any) {
      return {
        success: false,
        status: 'failed',
        message: `Failed to communicate with tool runtime: ${e.message}`,
        error: e.message,
        request_id: requestId,
      };
    }
  }
}
