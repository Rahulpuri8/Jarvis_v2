import { DEFAULT_SETTINGS } from '@buildos/shared/constants';
import type { AppSettings } from '@buildos/shared/types';
import { useEffect, useState } from 'react';

interface SettingsPageProps {
  settings: AppSettings | null;
  onSave: (settings: AppSettings) => Promise<void>;
  onBack: () => void;
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

  useEffect(() => {
    if (settings) {
      setFormState(settings);
    }
  }, [settings]);

  return (
    <div className="min-h-screen bg-slate-950 px-8 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-slate-900/70 p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200">Settings</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">AI Providers and Permissions</h1>
          </div>
          <button type="button" onClick={onBack} className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200">
            Back to Workspace
          </button>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Gemini API key</span>
            <input
              type="password"
              value={formState.geminiApiKey}
              onChange={(event) => setFormState((current) => ({ ...current, geminiApiKey: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Groq API key</span>
            <input
              type="password"
              value={formState.groqApiKey}
              onChange={(event) => setFormState((current) => ({ ...current, groqApiKey: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm text-slate-300">Ollama base URL</span>
            <input
              value={formState.ollamaBaseUrl}
              onChange={(event) => setFormState((current) => ({ ...current, ollamaBaseUrl: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Provider mode</span>
            <select
              value={formState.providerMode}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  providerMode: event.target.value as AppSettings['providerMode'],
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm"
            >
              <option value="cloud">Cloud</option>
              <option value="local">Local</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Provider</span>
            <select
              value={formState.selectedProvider}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  selectedProvider: event.target.value as AppSettings['selectedProvider'],
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm"
            >
              <option value="gemini">Gemini</option>
              <option value="groq">Groq</option>
              <option value="ollama">Ollama</option>
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm text-slate-300">Selected model</span>
            <input
              value={formState.selectedModel}
              onChange={(event) => setFormState((current) => ({ ...current, selectedModel: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm"
            />
          </label>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            ['requireCommandApproval', 'Require command approval'],
            ['requireFileApproval', 'Require file approval'],
            ['protectSensitiveFiles', 'Protect sensitive files'],
            ['allowProtectedReadsWithApproval', 'Allow protected reads with approval'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={formState[key as keyof AppSettings] as boolean}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-between gap-4 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm text-slate-300">
          <p>Settings are stored locally in SQLite for this desktop app. API keys are persisted locally in this V1 implementation.</p>
          <button
            type="button"
            onClick={() => void onSave(formState)}
            className="rounded-full bg-cyan-300 px-5 py-2 font-semibold text-slate-950"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
