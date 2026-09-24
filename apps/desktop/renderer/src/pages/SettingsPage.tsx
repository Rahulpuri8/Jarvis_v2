import { DEFAULT_SETTINGS } from '@buildos/shared/constants';
import type { AppSettings } from '@buildos/shared/types';
import { useEffect, useState } from 'react';

interface SettingsPageProps {
  settings: AppSettings | null;
  onSave: (settings: AppSettings) => Promise<void>;
  onBack: () => void;
}

interface OllamaModelInfo {
  name: string;
  size?: number;
  modifiedAt?: string;
}

export const SettingsPage = ({ settings, onSave, onBack }: SettingsPageProps) => {
  const [formState, setFormState] = useState<AppSettings>({
    geminiApiKey: '',
    groqApiKey: '',
    ollamaBaseUrl: DEFAULT_SETTINGS.ollamaBaseUrl,
    selectedProvider: DEFAULT_SETTINGS.selectedProvider,
    providerMode: DEFAULT_SETTINGS.providerMode,
    selectedModel: DEFAULT_SETTINGS.selectedModel,
    requireCommandApproval: DEFAULT_SETTINGS.requireCommandApproval,
    requireFileApproval: DEFAULT_SETTINGS.requireFileApproval,
    protectSensitiveFiles: DEFAULT_SETTINGS.protectSensitiveFiles,
    allowProtectedReadsWithApproval: DEFAULT_SETTINGS.allowProtectedReadsWithApproval,
  });

  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [ollamaModels, setOllamaModels] = useState<OllamaModelInfo[]>([]);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<{
    recordsCount: number;
    totalTokens: number;
    estimatedCostUsd: number;
    avgLatencyMs: number;
  } | null>(null);

  useEffect(() => {
    if ((window as any).buildos?.getTokenAnalytics) {
      (window as any).buildos.getTokenAnalytics().then(setAnalytics).catch(() => {});
    } else {
      try {
        const raw = localStorage.getItem('jarvis_token_analytics');
        if (raw) {
          setAnalytics(JSON.parse(raw));
        }
      } catch {}
    }
  }, []);

  const fetchOllamaInfo = async (baseUrl: string) => {
    setOllamaStatus('checking');
    try {
      const res = await fetch(`${baseUrl}/api/tags`);
      if (res.ok) {
        const data = (await res.json()) as { models?: Array<{ name: string; size?: number; modified_at?: string }> };
        setOllamaStatus('online');
        setOllamaModels(
          data.models?.map((m) => ({
            name: m.name,
            size: m.size,
            modifiedAt: m.modified_at,
          })) || [],
        );
      } else {
        setOllamaStatus('offline');
        setOllamaModels([]);
      }
    } catch {
      setOllamaStatus('offline');
      setOllamaModels([]);
    }
  };

  useEffect(() => {
    if (settings) {
      setFormState(settings);
      fetchOllamaInfo(settings.ollamaBaseUrl);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaveStatus('Saving...');
    try {
      await onSave(formState);
      setSaveStatus('Saved successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch {
      setSaveStatus('Failed to save.');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  return (
    <div className="jarvis-scanlines min-h-screen w-full overflow-y-auto bg-[#020a18] px-4 sm:px-8 py-8 text-slate-100 pb-36">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-cyan-400/20 bg-slate-900/80 p-6 sm:p-8 shadow-[0_0_40px_rgba(0,212,255,0.06)]">
        {/* Header with sticky-friendly top action bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-400/10 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-hud text-xs uppercase tracking-[0.3em] text-cyan-300">J.A.R.V.I.S CONFIG</span>
              <span className="font-mono-hud text-[10px] text-slate-500">// SYSTEM PROTOCOLS</span>
            </div>
            <h1 className="mt-2 font-hud text-2xl sm:text-3xl font-bold tracking-wide text-white text-glow">
              AI Providers and Permissions
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/20 px-5 py-2 font-hud text-xs uppercase tracking-[0.2em] text-cyan-200 transition hover:bg-cyan-400/30 hover:shadow-[0_0_15px_rgba(0,212,255,0.3)] active:scale-95"
            >
              <span>💾</span>
              <span>{saveStatus || 'Save Settings'}</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-hud text-xs uppercase tracking-wider text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-white"
            >
              Back to Workspace
            </button>
          </div>
        </div>

        {/* Form Inputs Grid */}
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block font-hud text-xs uppercase tracking-wider text-slate-300">Gemini API key</span>
            <input
              type="password"
              value={formState.geminiApiKey}
              onChange={(event) => setFormState((current) => ({ ...current, geminiApiKey: event.target.value }))}
              placeholder="AIzaSy..."
              className="w-full rounded-xl border border-cyan-400/20 bg-slate-950/80 px-4 py-3 font-mono-hud text-xs text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:shadow-[0_0_12px_rgba(0,212,255,0.15)]"
            />
          </label>
          <label className="block">
            <span className="mb-2 block font-hud text-xs uppercase tracking-wider text-slate-300">Groq API key</span>
            <input
              type="password"
              value={formState.groqApiKey}
              onChange={(event) => setFormState((current) => ({ ...current, groqApiKey: event.target.value }))}
              placeholder="gsk_..."
              className="w-full rounded-xl border border-cyan-400/20 bg-slate-950/80 px-4 py-3 font-mono-hud text-xs text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:shadow-[0_0_12px_rgba(0,212,255,0.15)]"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block font-hud text-xs uppercase tracking-wider text-slate-300">Ollama base URL</span>
            <div className="flex gap-2">
              <input
                value={formState.ollamaBaseUrl}
                onChange={(event) => setFormState((current) => ({ ...current, ollamaBaseUrl: event.target.value }))}
                className="w-full rounded-xl border border-cyan-400/20 bg-slate-950/80 px-4 py-3 font-mono-hud text-xs text-white focus:border-cyan-400 focus:outline-none focus:shadow-[0_0_12px_rgba(0,212,255,0.15)]"
              />
              <button
                type="button"
                onClick={() => fetchOllamaInfo(formState.ollamaBaseUrl)}
                className="whitespace-nowrap rounded-xl border border-cyan-400/40 bg-cyan-400/15 px-4 font-hud text-[11px] uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-400/25 hover:shadow-[0_0_15px_rgba(0,212,255,0.2)]"
              >
                Check Connection
              </button>
            </div>
          </label>
          <label className="block">
            <span className="mb-2 block font-hud text-xs uppercase tracking-wider text-slate-300">Provider mode</span>
            <select
              value={formState.providerMode}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  providerMode: event.target.value as AppSettings['providerMode'],
                }))
              }
              className="w-full rounded-xl border border-cyan-400/20 bg-slate-950/80 px-4 py-3 font-mono-hud text-xs text-white focus:border-cyan-400 focus:outline-none focus:shadow-[0_0_12px_rgba(0,212,255,0.15)]"
            >
              <option value="cloud">Cloud</option>
              <option value="local">Local</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block font-hud text-xs uppercase tracking-wider text-slate-300">Provider</span>
            <select
              value={formState.selectedProvider}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  selectedProvider: event.target.value as AppSettings['selectedProvider'],
                }))
              }
              className="w-full rounded-xl border border-cyan-400/20 bg-slate-950/80 px-4 py-3 font-mono-hud text-xs text-white focus:border-cyan-400 focus:outline-none focus:shadow-[0_0_12px_rgba(0,212,255,0.15)]"
            >
              <option value="gemini">Gemini</option>
              <option value="groq">Groq</option>
              <option value="ollama">Ollama</option>
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block font-hud text-xs uppercase tracking-wider text-slate-300">Selected model</span>
            <input
              value={formState.selectedModel}
              onChange={(event) => setFormState((current) => ({ ...current, selectedModel: event.target.value }))}
              placeholder="e.g. qwen2.5-coder:7b"
              className="w-full rounded-xl border border-cyan-400/20 bg-slate-950/80 px-4 py-3 font-mono-hud text-xs text-white focus:border-cyan-400 focus:outline-none focus:shadow-[0_0_12px_rgba(0,212,255,0.15)]"
            />
          </label>
        </div>

        {/* Ollama Local Models Manager Panel */}
        <div className="mt-8 rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-5 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">🦙</span>
              <div>
                <h3 className="font-hud text-xs uppercase tracking-wider text-white">Local Ollama Models Dashboard</h3>
                <p className="font-mono-hud text-[10px] text-slate-400">Status & installed local offline LLMs</p>
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 font-mono-hud text-[11px] font-semibold ${
                ollamaStatus === 'online'
                  ? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-300 text-glow'
                  : ollamaStatus === 'offline'
                  ? 'border border-rose-500/30 bg-rose-500/20 text-rose-300'
                  : 'border border-amber-500/30 bg-amber-500/20 text-amber-300'
              }`}
            >
              {ollamaStatus === 'online' ? '● Online' : ollamaStatus === 'offline' ? '○ Offline' : '... Checking'}
            </span>
          </div>

          {ollamaStatus === 'online' && (
            <div className="mt-4">
              <p className="mb-2 font-mono-hud text-[11px] text-slate-400">Click a model to set it as active model:</p>
              {ollamaModels.length === 0 ? (
                <p className="font-mono-hud text-xs text-slate-500 italic">No local models found in Ollama. Pull a model using `ollama pull qwen2.5`.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {ollamaModels.map((model) => (
                    <button
                      key={model.name}
                      type="button"
                      onClick={() =>
                        setFormState((current) => ({
                          ...current,
                          selectedModel: model.name,
                          selectedProvider: 'ollama',
                          providerMode: 'local',
                        }))
                      }
                      className={`flex items-center rounded-xl border px-3 py-2 font-mono-hud text-xs transition ${
                        formState.selectedModel === model.name
                          ? 'border-cyan-400 bg-cyan-400/25 text-cyan-100 shadow-[0_0_12px_rgba(0,212,255,0.3)]'
                          : 'border-white/10 bg-slate-900 text-slate-300 hover:border-cyan-400/30 hover:bg-cyan-400/10'
                      }`}
                    >
                      <span className="font-semibold">{model.name}</span>
                      {model.size && (
                        <span className="ml-2 text-[10px] text-cyan-400/60">
                          ({(model.size / (1024 * 1024 * 1024)).toFixed(1)} GB)
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Token & Cost Analytics Panel */}
        <div className="mt-8 rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-5 shadow-inner">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-xl">📊</span>
            <div>
              <h3 className="font-hud text-xs uppercase tracking-wider text-white">Token Usage & Cost Analytics</h3>
              <p className="font-mono-hud text-[10px] text-slate-400">LLM token consumption, cost metrics, & performance</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3.5">
              <p className="font-mono-hud text-[10px] uppercase tracking-wider text-slate-400">Total Tokens</p>
              <p className="mt-1 font-mono-hud text-xl font-bold text-cyan-300">
                {analytics?.totalTokens.toLocaleString() || '0'}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3.5">
              <p className="font-mono-hud text-[10px] uppercase tracking-wider text-slate-400">Est. API Cost</p>
              <p className="mt-1 font-mono-hud text-xl font-bold text-emerald-300">
                ${analytics?.estimatedCostUsd.toFixed(4) || '0.0000'}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3.5">
              <p className="font-mono-hud text-[10px] uppercase tracking-wider text-slate-400">Avg Latency</p>
              <p className="mt-1 font-mono-hud text-xl font-bold text-amber-300">
                {analytics?.avgLatencyMs || 0} ms
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3.5">
              <p className="font-mono-hud text-[10px] uppercase tracking-wider text-slate-400">Total Requests</p>
              <p className="mt-1 font-mono-hud text-xl font-bold text-indigo-300">
                {analytics?.recordsCount || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Security & Permissions Checkboxes */}
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="font-hud text-xs uppercase tracking-wider text-cyan-300">Security & Execution Boundaries</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['requireCommandApproval', 'Require command approval', 'All shell executions require user confirmation'],
              ['requireFileApproval', 'Require file approval', 'All file modifications require review'],
              ['protectSensitiveFiles', 'Protect sensitive files', 'Lock environment variables and credential files'],
              ['allowProtectedReadsWithApproval', 'Allow protected reads with approval', 'Prompt user when reading sensitive configs'],
            ].map(([key, label, desc]) => (
              <label
                key={key}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-cyan-400/15 bg-slate-950/70 p-3.5 transition hover:border-cyan-400/40 hover:bg-cyan-400/5"
              >
                <input
                  type="checkbox"
                  checked={formState[key as keyof AppSettings] as boolean}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 accent-cyan-400 cursor-pointer"
                />
                <div>
                  <span className="font-body text-sm font-medium text-slate-200">{label}</span>
                  <p className="font-mono-hud text-[10px] text-slate-500 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Save Bar & Storage Notice */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-400/25 bg-cyan-950/20 p-5 text-sm text-slate-300 shadow-[0_0_20px_rgba(0,212,255,0.05)]">
          <p className="font-mono-hud text-xs text-slate-400 max-w-lg leading-relaxed">
            Settings are stored locally in SQLite. API keys are encrypted locally using machine-scoped AES-256-GCM.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full border border-cyan-400/50 bg-cyan-400 px-6 py-2.5 font-hud text-xs uppercase tracking-[0.2em] font-semibold text-slate-950 shadow-[0_0_20px_rgba(0,212,255,0.3)] transition hover:bg-cyan-300 active:scale-95"
            >
              {saveStatus || 'Save Settings'}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-white/10 px-4 py-2 font-hud text-xs uppercase tracking-wider text-slate-300 transition hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
