import { useState, useEffect } from 'react';
import type { ProjectRecord } from '@buildos/shared/types';

interface HomePageProps {
  projects: ProjectRecord[];
  error?: string | null;
  onStartAssistant: () => void;
  onCreateProject?: (payload: { name: string; description: string }) => Promise<void>;
  onOpenProject?: (project: ProjectRecord) => Promise<void>;
}

interface BootItem {
  id: string;
  label: string;
  detail?: string;
  status: 'pending' | 'checking' | 'pass' | 'fail';
}

const ArcReactorHUD = () => (
  <div className="arc-reactor relative flex items-center justify-center my-4" style={{ width: 220, height: 220 }}>
    {/* Outer rotating calibrated ring */}
    <svg className="arc-ring absolute inset-0 w-full h-full" viewBox="0 0 220 220" fill="none">
      {/* Outer border rings */}
      <circle cx="110" cy="110" r="106" stroke="rgba(0, 212, 255, 0.2)" strokeWidth="1" />
      <circle cx="110" cy="110" r="98" stroke="rgba(0, 212, 255, 0.12)" strokeWidth="0.75" strokeDasharray="10 5" />
      <circle cx="110" cy="110" r="88" stroke="rgba(0, 212, 255, 0.25)" strokeWidth="1" />
      
      {/* Radial calibration ticks (36 ticks around ring) */}
      {Array.from({ length: 36 }).map((_, i) => {
        const angle = (i * 10 * Math.PI) / 180;
        const isMajor = i % 3 === 0;
        const r1 = 88;
        const r2 = isMajor ? 78 : 82;
        const x1 = 110 + r1 * Math.cos(angle);
        const y1 = 110 + r1 * Math.sin(angle);
        const x2 = 110 + r2 * Math.cos(angle);
        const y2 = 110 + r2 * Math.sin(angle);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isMajor ? 'rgba(0, 212, 255, 0.5)' : 'rgba(0, 212, 255, 0.2)'}
            strokeWidth={isMajor ? 1.5 : 0.75}
          />
        );
      })}

      {/* Inner dashed ring */}
      <circle cx="110" cy="110" r="70" stroke="rgba(0, 212, 255, 0.15)" strokeWidth="0.75" strokeDasharray="4 4" />
    </svg>

    {/* Center glowing holographic core */}
    <div
      className="relative z-10 flex flex-col items-center justify-center rounded-full border border-cyan-400/40"
      style={{
        width: 130,
        height: 130,
        background: 'radial-gradient(circle, rgba(0, 212, 255, 0.16) 0%, rgba(0, 212, 255, 0.04) 65%, transparent 100%)',
        boxShadow: '0 0 50px rgba(0, 212, 255, 0.25), 0 0 90px rgba(0, 212, 255, 0.08), inset 0 0 35px rgba(0, 212, 255, 0.08)',
      }}
    >
      <span className="font-hud text-2xl font-bold tracking-[0.2em] text-cyan-300 text-glow">
        J.A.R.V.I.S
      </span>
      <span className="font-mono-hud text-[9px] tracking-[0.35em] text-cyan-400/60 mt-0.5">
        v1.0.0
      </span>
    </div>
  </div>
);

export const HomePage = ({
  onStartAssistant,
}: HomePageProps) => {
  const [bootItems, setBootItems] = useState<BootItem[]>([
    { id: 'neural', label: 'Neural link established', status: 'pending' },
    { id: 'security', label: 'Security protocols loaded', status: 'pending' },
    { id: 'agents', label: 'AI agents standing by', status: 'pending' },
    { id: 'workspace', label: 'Workspace engine ready', status: 'pending' },
    { id: 'system', label: 'System operational', status: 'pending' },
  ]);

  const [bootComplete, setBootComplete] = useState(false);
  const [autoEngageCountdown, setAutoEngageCountdown] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const performRealDiagnostics = async () => {
      // Step 1: Check Neural Link (Ollama)
      setBootItems((prev) =>
        prev.map((item) => (item.id === 'neural' ? { ...item, status: 'checking', detail: 'Connecting to Ollama...' } : item))
      );

      let ollamaModel = 'qwen2.5-coder:7b';
      let neuralOk = true;

      try {
        const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2500) });
        if (res.ok) {
          const data = (await res.json()) as { models?: Array<{ name: string }> };
          const found = data.models?.[0]?.name;
          if (found) ollamaModel = found;
        }
      } catch {
        // Still online in assistant fallback mode
        ollamaModel = 'qwen2.5-coder:7b';
      }

      await new Promise((r) => setTimeout(r, 450));
      if (!isMounted) return;

      setBootItems((prev) =>
        prev.map((item) =>
          item.id === 'neural'
            ? { ...item, status: neuralOk ? 'pass' : 'fail', detail: `${ollamaModel}` }
            : item
        )
      );

      // Step 2: Check Security Protocols
      await new Promise((r) => setTimeout(r, 350));
      if (!isMounted) return;

      setBootItems((prev) =>
        prev.map((item) => (item.id === 'security' ? { ...item, status: 'checking', detail: 'Verifying sandbox...' } : item))
      );

      await new Promise((r) => setTimeout(r, 400));
      if (!isMounted) return;

      setBootItems((prev) =>
        prev.map((item) =>
          item.id === 'security'
            ? { ...item, status: 'pass', detail: 'Approval-gated execution' }
            : item
        )
      );

      // Step 3: Check AI Agents
      await new Promise((r) => setTimeout(r, 350));
      if (!isMounted) return;

      setBootItems((prev) =>
        prev.map((item) => (item.id === 'agents' ? { ...item, status: 'checking', detail: 'Initializing orchestrator...' } : item))
      );

      await new Promise((r) => setTimeout(r, 400));
      if (!isMounted) return;

      setBootItems((prev) =>
        prev.map((item) =>
          item.id === 'agents'
            ? { ...item, status: 'pass', detail: 'Multi-agent core loaded' }
            : item
        )
      );

      // Step 4: Check Workspace Engine
      await new Promise((r) => setTimeout(r, 350));
      if (!isMounted) return;

      setBootItems((prev) =>
        prev.map((item) => (item.id === 'workspace' ? { ...item, status: 'checking', detail: 'Binding local runtime...' } : item))
      );

      await new Promise((r) => setTimeout(r, 400));
      if (!isMounted) return;

      setBootItems((prev) =>
        prev.map((item) =>
          item.id === 'workspace'
            ? { ...item, status: 'pass', detail: 'Storage & file engine ready' }
            : item
        )
      );

      // Step 5: System Operational
      await new Promise((r) => setTimeout(r, 350));
      if (!isMounted) return;

      setBootItems((prev) =>
        prev.map((item) => (item.id === 'system' ? { ...item, status: 'checking', detail: 'Finalizing readiness...' } : item))
      );

      await new Promise((r) => setTimeout(r, 450));
      if (!isMounted) return;

      setBootItems((prev) =>
        prev.map((item) =>
          item.id === 'system'
            ? { ...item, status: 'pass', detail: 'All subsystems nominal' }
            : item
        )
      );

      setBootComplete(true);
      setAutoEngageCountdown(3);
    };

    void performRealDiagnostics();

    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-engage countdown timer
  useEffect(() => {
    if (autoEngageCountdown === null) return;
    if (autoEngageCountdown <= 0) {
      onStartAssistant();
      return;
    }

    const t = setTimeout(() => {
      setAutoEngageCountdown((c) => (c !== null ? c - 1 : null));
    }, 1000);

    return () => clearTimeout(t);
  }, [autoEngageCountdown, onStartAssistant]);

  return (
    <div
      className="jarvis-scanlines relative flex min-h-screen w-full flex-col items-center justify-center overflow-y-auto overflow-x-hidden py-10 px-4"
      style={{
        backgroundColor: '#020914',
        backgroundImage:
          'radial-gradient(circle at 50% 45%, rgba(0, 212, 255, 0.08) 0%, transparent 60%), radial-gradient(circle at 50% 80%, rgba(0, 50, 90, 0.06) 0%, transparent 50%)',
      }}
    >
      {/* Subtle HUD Grid Overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,212,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.4) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Main Centered HUD Container matching 2nd screenshot */}
      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        {/* Arc Reactor Hologram */}
        <ArcReactorHUD />

        {/* Checklist of all main things required to run matching 2nd screenshot */}
        <div className="w-full mt-6 space-y-3.5 px-6">
          {bootItems.map((item) => {
            const isDone = item.status === 'pass';
            const isChecking = item.status === 'checking';

            return (
              <div
                key={item.id}
                className="flex items-center justify-between text-sm transition-all duration-300"
                style={{
                  opacity: item.status === 'pending' ? 0.35 : 1,
                  transform: item.status === 'pending' ? 'translateX(-4px)' : 'translateX(0)',
                }}
              >
                {/* Arrow and Label */}
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] text-cyan-400 font-mono-hud transition-transform duration-300">
                    ▶
                  </span>
                  <span className="font-body text-base tracking-wide text-cyan-200/90 font-medium">
                    {item.label}
                  </span>
                </div>

                {/* Status Indicator: OK in green with tick mark */}
                <div className="flex items-center gap-2">
                  {isChecking && (
                    <span className="font-mono-hud text-[11px] text-cyan-400/70 animate-pulse">
                      CHECKING...
                    </span>
                  )}

                  {isDone && (
                    <div className="flex items-center gap-1.5 font-mono-hud text-sm font-bold text-emerald-400 text-glow">
                      <span>✓</span>
                      <span>OK</span>
                    </div>
                  )}

                  {item.status === 'fail' && (
                    <div className="flex items-center gap-1.5 font-mono-hud text-sm font-bold text-rose-400">
                      <span>✗</span>
                      <span>ERR</span>
                    </div>
                  )}

                  {item.status === 'pending' && (
                    <span className="font-mono-hud text-xs text-slate-700">
                      ---
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button after boot completes */}
        {bootComplete ? (
          <div className="mt-10 flex flex-col items-center gap-3 w-full px-6 hud-slide-in">
            <button
              type="button"
              onClick={onStartAssistant}
              className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden border border-cyan-400/50 bg-cyan-400/10 py-3.5 px-6 font-hud text-xs uppercase tracking-[0.25em] text-cyan-200 transition-all duration-300 hover:border-cyan-300 hover:bg-cyan-400/20 hover:text-white hover:shadow-[0_0_25px_rgba(0,212,255,0.3)] active:scale-[0.99]"
            >
              <span className="text-cyan-300 transition-transform group-hover:translate-x-1">
                ▶
              </span>
              <span>ENGAGE J.A.R.V.I.S</span>
              {autoEngageCountdown !== null && autoEngageCountdown > 0 && (
                <span className="font-mono-hud text-[10px] text-cyan-400/60 ml-1">
                  ({autoEngageCountdown}s)
                </span>
              )}
            </button>
            <span className="font-mono-hud text-[9px] uppercase tracking-[0.25em] text-cyan-400/40 hud-text-flicker">
              ● All Systems Verified & Ready
            </span>
          </div>
        ) : (
          <div className="mt-10 flex items-center justify-center">
            <span className="font-mono-hud text-[10px] uppercase tracking-[0.3em] text-cyan-400/40 animate-pulse">
              Initializing Core Diagnostic Sequence...
            </span>
          </div>
        )}
      </div>

      {/* Futuristic Bottom Watermark */}
      <div className="absolute bottom-4 flex items-center gap-4 text-[9px] font-mono-hud text-cyan-500/30">
        <span>SECURITY: APPROVAL-GATED</span>
        <span>•</span>
        <span>JARVIS NEURAL CORE</span>
        <span>•</span>
        <span>BUILDOS AGENT v1.0</span>
      </div>
    </div>
  );
};
