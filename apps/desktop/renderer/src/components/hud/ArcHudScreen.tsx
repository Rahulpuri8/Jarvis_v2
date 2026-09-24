import { useState, useEffect, useRef } from 'react';
import type {
  ProjectRecord,
  TaskRecord,
  MessageRecord,
  PendingActionRecord,
  CommandRunRecord,
} from '@buildos/shared/types';
import type { SystemSpecs } from '../../pages/WorkspacePage';
import {
  speakJarvisVoice,
  stopJarvisVoice,
  isVoiceResponseMuted,
  setVoiceResponseMuted,
} from '../../utils/speech';

interface ArcHudScreenProps {
  project: ProjectRecord;
  tasks: TaskRecord[];
  messages: MessageRecord[];
  pendingActions: PendingActionRecord[];
  commandRuns: CommandRunRecord[];
  specs: SystemSpecs | null;
  onSendMessage: (content: string) => Promise<void>;
  onApproveAction: (actionId: string) => Promise<void>;
  onRejectAction: (actionId: string) => Promise<void>;
  onSwitchTab: (tab: 'assistant' | 'workspace' | 'apps' | 'approvals' | 'telemetry') => void;
  onSelectFolder?: () => Promise<void>;
}

export const ArcHudScreen = ({
  project,
  tasks,
  messages,
  pendingActions,
  commandRuns,
  specs,
  onSendMessage,
  onApproveAction,
  onRejectAction,
  onSwitchTab,
  onSelectFolder,
}: ArcHudScreenProps) => {
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'transcribing' | 'processing'>('idle');
  const [transcribedText, setTranscribedText] = useState<string>('');
  const [commandInput, setCommandInput] = useState<string>('');
  const [speechFeedback, setSpeechFeedback] = useState<string>(
    'Systems online, Sir. Arc Reactor operational. Ready for your command.'
  );
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [voiceMuted, setVoiceMuted] = useState<boolean>(isVoiceResponseMuted());

  // Holographic Windows Visibility State
  const [showTasksWindow, setShowTasksWindow] = useState<boolean>(true);
  const [showTerminalWindow, setShowTerminalWindow] = useState<boolean>(true);
  const [showSpecsWindow, setShowSpecsWindow] = useState<boolean>(true);
  const [showApprovalWindow, setShowApprovalWindow] = useState<boolean>(true);

  // Auto-vocalize assistant response whenever a new message arrives
  const latestJarvisMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastSpokenIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (latestJarvisMessage && latestJarvisMessage.id !== lastSpokenIdRef.current) {
      lastSpokenIdRef.current = latestJarvisMessage.id;
      setSpeechFeedback(latestJarvisMessage.content);
      speakJarvisVoice(latestJarvisMessage.content, {
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
      });
    }
  }, [latestJarvisMessage?.id, latestJarvisMessage?.content]);

  // Keep approval window open automatically when pending actions arrive
  useEffect(() => {
    if (pendingActions.length > 0) {
      setShowApprovalWindow(true);
    }
  }, [pendingActions.length]);

  // Audio synthesis feedback
  const speakFeedback = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;
      // Prefer British or natural English voice if available
      const voices = window.speechSynthesis.getVoices();
      const jarvisVoice = voices.find(
        (v) =>
          v.name.includes('George') ||
          v.name.includes('Oliver') ||
          v.name.includes('Daniel') ||
          v.name.includes('Natural') ||
          v.lang.startsWith('en-GB') ||
          v.lang.startsWith('en-US')
      );
      if (jarvisVoice) utterance.voice = jarvisVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Speech Recognition handler with automatic execution
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const silenceTimerRef = useRef<any>(null);

  const toggleVoiceListening = () => {
    if (voiceStatus === 'listening') {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setVoiceStatus('idle');
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        transcriptRef.current = '';

        recognition.onstart = () => {
          setVoiceStatus('listening');
          setTranscribedText('Listening to Sir... Speak your command.');
        };

        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          const currentText = (final || interim).trim();
          if (currentText) {
            transcriptRef.current = currentText;
            setTranscribedText(currentText);
            setCommandInput(currentText);
          }

          // If speech recognition marked final sentence, auto-execute immediately
          if (final.trim()) {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            try {
              recognition.stop();
            } catch {}
            executeCommand(final.trim());
            return;
          }

          // If user pauses speaking for 1.2s, auto-execute without requiring transmit button
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            const pending = transcriptRef.current.trim();
            if (pending) {
              try {
                recognition.stop();
              } catch {}
              executeCommand(pending);
            }
          }, 1200);
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition notice:', e.error);
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          setVoiceStatus('idle');
        };

        recognition.onend = () => {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          const pending = transcriptRef.current.trim();
          if (pending && voiceStatus === 'listening') {
            executeCommand(pending);
          } else {
            setVoiceStatus('idle');
          }
        };

        recognition.start();
        return;
      } catch (err) {
        console.warn('Web Speech API unavailable, falling back to python tool', err);
      }
    }

    // Fallback: Python Tool Voice
    setVoiceStatus('listening');
    setTranscribedText('Connecting to offline neural audio processor...');
    if ((window as any).buildos?.executeTool) {
      void (window as any).buildos
        .executeTool({ tool: 'voice.listen' })
        .then((res: any) => {
          if (res?.data?.text) {
            setTranscribedText(res.data.text);
            executeCommand(res.data.text);
          } else {
            setVoiceStatus('idle');
          }
        })
        .catch(() => setVoiceStatus('idle'));
    } else {
      setTimeout(() => {
        setVoiceStatus('idle');
        setTranscribedText('Voice input ready. Transcribe via microphone or manual input.');
      }, 2500);
    }
  };

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim()) return;
    setVoiceStatus('processing');
    setTranscribedText(`Executing: "${cmd}"`);
    setSpeechFeedback(`Right away, Sir. Processing "${cmd.slice(0, 45)}"...`);
    speakFeedback(`Right away, Sir.`);

    // Automatically ensure task window is opened
    setShowTasksWindow(true);
    setShowTerminalWindow(true);

    try {
      await onSendMessage(cmd);
      setSpeechFeedback(`Task instruction dispatched to neural core, Sir.`);
    } catch {
      setSpeechFeedback(`Apologies Sir, encountered an issue executing command.`);
    } finally {
      setVoiceStatus('idle');
      setCommandInput('');
    }
  };

  const renderJarvisIntel = (rawText: string) => {
    if (!rawText) return null;

    let cleanText = rawText.trim();
    if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
      cleanText = cleanText.slice(1, -1);
    }

    // Auto-split inline numbered items if packed into a single paragraph
    const normalized = cleanText
      .replace(/(\s+\d+\.\s+\*\*)/g, '\n$1')
      .replace(/(\s+•\s+)/g, '\n$1');

    const lines = normalized
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const formatInlineText = (text: string) => {
      const parts = text.split(/(\*\*[^*]+\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <span key={i} className="font-semibold text-cyan-200">
              {part.slice(2, -2)}
            </span>
          );
        }
        return part;
      });
    };

    return (
      <div className="space-y-1.5 text-left font-mono-hud text-xs">
        {lines.map((line, idx) => {
          const isBullet = /^[•\-\*]/.test(line);
          const isNumbered = /^\d+\.\s*/.test(line);

          if (isBullet || isNumbered) {
            const content = line.replace(/^[•\-\*]\s*/, '').replace(/^\d+\.\s*/, '');
            return (
              <div
                key={idx}
                className="flex items-start gap-2 px-2.5 py-1.5 rounded-sm bg-cyan-950/35 border border-cyan-400/20 shadow-[0_0_12px_rgba(0,212,255,0.06)] hover:border-cyan-400/40 transition"
              >
                <span className="text-cyan-400 font-bold text-xs mt-0.5 select-none">◈</span>
                <div className="text-slate-200 leading-relaxed flex-1">
                  {formatInlineText(content)}
                </div>
              </div>
            );
          }

          return (
            <p key={idx} className="text-cyan-100/90 leading-relaxed px-1">
              {formatInlineText(line)}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative flex flex-col min-h-[750px] w-full p-4 overflow-hidden select-none">
      {/* ── Background Subtle Arc Grid & Radial Glow ── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle at 50% 38%, rgba(0,212,255,0.12) 0%, rgba(2,10,24,0.85) 60%, #020a18 100%)',
        }}
      />

      {/* ── Top HUD Status Telemetry Strip ── */}
      <div className="relative z-10 flex flex-wrap items-center justify-between border-b border-cyan-400/20 pb-2 mb-4 font-mono-hud text-[10px] text-cyan-400/80">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold tracking-[0.2em] text-white">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            STARK INDUSTRIES // MARK VII NEURAL HUD
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400">ARC CORE: 100% NOMINAL</span>
          {specs && (
            <>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-300 font-semibold">
                GPU: {specs.gpuName ? specs.gpuName.replace('NVIDIA GeForce ', '').replace(' Laptop GPU', '') : 'RTX 4050'} ({specs.gpuUsagePercent ?? 15}%)
              </span>
            </>
          )}
          <span className="text-slate-600">|</span>
          <span className="text-cyan-300">
            ACTIVE WINDOWS:{' '}
            {[showTasksWindow && 'TASKS', showTerminalWindow && 'TERMINAL', showSpecsWindow && 'SPECS', showApprovalWindow && 'GATE']
              .filter(Boolean)
              .join(' • ')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">VOICE MATRIX:</span>
          <span
            className={`font-semibold uppercase tracking-wider ${
              isSpeaking
                ? 'text-amber-300 animate-pulse'
                : voiceStatus === 'listening'
                ? 'text-rose-400 animate-pulse'
                : voiceStatus === 'processing'
                ? 'text-amber-400 animate-pulse'
                : 'text-cyan-300'
            }`}
          >
            ● {isSpeaking ? 'SPEAKING' : voiceStatus}
          </span>
          <button
            type="button"
            onClick={() => {
              const newMuted = !voiceMuted;
              setVoiceMuted(newMuted);
              setVoiceResponseMuted(newMuted);
              if (newMuted) {
                stopJarvisVoice();
                setIsSpeaking(false);
              }
            }}
            className={`ml-2 border px-2 py-0.5 font-mono-hud text-[9px] uppercase tracking-wider transition ${
              voiceMuted
                ? 'border-slate-700 bg-slate-900/60 text-slate-500 hover:text-slate-300'
                : 'border-cyan-400/40 bg-cyan-400/15 text-cyan-300 hover:bg-cyan-400/30'
            }`}
            title="Toggle Voice Output (Spoken Responses)"
          >
            {voiceMuted ? '🔇 Voice Muted' : '🔊 Voice Output ON'}
          </button>
          <button
            type="button"
            onClick={() => onSwitchTab('assistant')}
            className="ml-2 border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[9px] uppercase tracking-wider text-cyan-300 hover:bg-cyan-400/25 transition"
          >
            Full Chat ↗
          </button>
        </div>
      </div>

      {/* ── Main Dynamic Arc Canvas: Center Core + Floating Holographic Windows ── */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-start">
        {/* ── Left Holographic Window: Operations & Task Pipeline ── */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {showTasksWindow && (
            <div className="hud-panel p-3 border border-cyan-400/30 bg-[#020a18]/90 shadow-[0_0_25px_rgba(0,212,255,0.08)]">
              <div className="flex items-center justify-between border-b border-cyan-400/20 pb-1.5 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <span className="font-hud text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
                    Neural Operations
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono-hud text-[9px] text-cyan-400/70">
                    {tasks.length} active
                  </span>
                  <button
                    onClick={() => setShowTasksWindow(false)}
                    className="text-slate-500 hover:text-slate-300 text-xs px-1"
                    title="Minimize Window"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {tasks.length === 0 ? (
                  <div className="py-6 text-center text-[11px] font-mono-hud text-slate-500">
                    ◈ No active workflows dispatched.
                    <br />
                    Speak or transmit command to initiate.
                  </div>
                ) : (
                  tasks.slice(0, 6).map((task) => (
                    <div
                      key={task.id}
                      className="border border-cyan-400/15 bg-cyan-400/5 p-2 rounded-sm transition hover:border-cyan-400/40"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono-hud mb-1">
                        <span className="text-cyan-200 truncate max-w-[150px] font-medium">
                          {task.title}
                        </span>
                        <span
                          className={`text-[9px] px-1 rounded uppercase ${
                            task.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : task.status === 'in_progress'
                              ? 'bg-cyan-500/20 text-cyan-300 animate-pulse'
                              : 'bg-slate-700/30 text-slate-400'
                          }`}
                        >
                          {task.status}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800/80 h-1 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            task.status === 'completed'
                              ? 'bg-emerald-400 w-full'
                              : task.status === 'in_progress'
                              ? 'bg-cyan-400 w-3/4 animate-pulse'
                              : 'bg-slate-600 w-1/4'
                          }`}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={() => onSwitchTab('workspace')}
                className="mt-2 w-full text-center font-mono-hud text-[9px] uppercase tracking-wider text-cyan-400/70 hover:text-cyan-300 hover:underline pt-1 border-t border-cyan-400/10"
              >
                Inspect All Tasks & Docs ↗
              </button>
            </div>
          )}

          {/* Quick Diagnostics Gauge Window */}
          {showSpecsWindow && specs && (
            <div className="hud-panel p-3 border border-cyan-400/20 bg-[#020a18]/90">
              <div className="flex items-center justify-between border-b border-cyan-400/20 pb-1 mb-2">
                <span className="font-hud text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                  System Diagnostics
                </span>
                <button
                  onClick={() => setShowSpecsWindow(false)}
                  className="text-slate-500 hover:text-slate-300 text-xs px-1"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono-hud text-[10px]">
                <div className="border border-cyan-400/10 bg-cyan-950/20 p-2">
                  <div className="text-slate-400 text-[9px]">RAM USAGE</div>
                  <div
                    className={`text-sm font-bold ${
                      specs.isThrottlingAdvised ? 'text-amber-400' : 'text-cyan-300'
                    }`}
                  >
                    {specs.memoryPercent}%
                  </div>
                  <div className="text-[8px] text-slate-500">
                    {specs.usedMemGb} / {specs.totalMemGb} GB
                  </div>
                </div>

                <div className="border border-cyan-400/10 bg-cyan-950/20 p-2">
                  <div className="text-slate-400 text-[9px]">CPU STATUS</div>
                  <div className="text-sm font-bold text-emerald-400">
                    {specs.cpuUsagePercent ?? 12}%
                  </div>
                  <div className="text-[8px] text-slate-500">
                    {specs.cpuCores ?? 8} LOGICAL CORES
                  </div>
                </div>

                {/* Dedicated GPU Hardware Telemetry Card */}
                <div className="col-span-2 border border-cyan-400/25 bg-cyan-950/30 p-2.5 rounded-sm">
                  <div className="flex items-center justify-between text-[9px] text-slate-400 mb-1">
                    <span className="font-hud text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      GPU // {specs.gpuName ? specs.gpuName.replace('NVIDIA GeForce ', '') : 'RTX 4050 Laptop GPU'}
                    </span>
                    <span className="text-emerald-400 font-mono-hud font-semibold">
                      {specs.gpuTempC ?? 59}°C NOMINAL
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between mb-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-cyan-200">
                        {specs.gpuUsagePercent ?? 0}%
                      </span>
                      <span className="text-[8px] uppercase tracking-wider text-slate-400">
                        GPU LOAD
                      </span>
                    </div>
                    <div className="text-[9px] text-cyan-400/80 font-mono-hud">
                      VRAM: {specs.gpuMemUsedGb ?? 0.6} / {specs.gpuMemTotalGb ?? 6.0} GB ({specs.gpuMemPercent ?? 10}%)
                    </div>
                  </div>

                  <div className="w-full bg-slate-900/80 h-1.5 rounded-full overflow-hidden border border-cyan-400/10">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                      style={{ width: `${Math.max(6, specs.gpuUsagePercent ?? 0)}%` }}
                    />
                  </div>
                </div>

                {/* Dedicated Local Drives Telemetry Card */}
                {specs.drives && specs.drives.length > 0 && (
                  <div className="col-span-2 border border-cyan-400/20 bg-cyan-950/20 p-2 rounded-sm mt-0.5">
                    <div className="flex items-center justify-between text-[9px] text-slate-400 mb-1.5">
                      <span className="font-hud text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        STORAGE // {specs.drives.length} DRIVES MOUNTED
                      </span>
                      <span className="text-[8px] font-mono-hud text-slate-400">
                        NTFS NVMe
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {specs.drives.map((drv) => (
                        <div key={drv.drive} className="bg-black/40 p-1.5 rounded border border-cyan-400/10">
                          <div className="flex items-center justify-between text-[9px] mb-1">
                            <span className="font-bold text-white flex items-center gap-1">
                              <span className="text-cyan-400">💾</span>
                              Drive {drv.drive}
                            </span>
                            <span className="text-slate-300 font-mono-hud text-[9px]">
                              <strong className="text-cyan-300">{drv.used_gb}</strong> / {drv.total_gb} GB ({drv.percent}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-cyan-400/10">
                            <div
                              className={`h-full transition-all duration-300 ${
                                drv.percent > 85 ? 'bg-amber-400' : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                              }`}
                              style={{ width: `${drv.percent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[8px] text-slate-500 mt-0.5 font-mono-hud">
                            <span>Free: {drv.free_gb} GB</span>
                            <span>{drv.mountpoint}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {specs.isThrottlingAdvised && (
                <div className="mt-2 border border-amber-400/30 bg-amber-500/10 p-1.5 text-[9px] font-mono-hud text-amber-300 flex items-center gap-1.5">
                  <span className="animate-pulse">⚠</span>
                  RESOURCE GUARD: Auto-throttling active to protect RAM.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CENTER: THE CINEMATIC ARC REACTOR CORE & LIVE SPEECH TRANSCRIPTION ── */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center my-2">
          {/* Arc Reactor Visual Matrix */}
          <div className="relative flex items-center justify-center h-72 w-72 sm:h-80 sm:w-80">
            {/* Outer Orbital Ring with Coordinate Ticks */}
            <div className="absolute inset-0 rounded-full border border-cyan-400/25 arc-ring" />
            <div className="absolute -inset-2 rounded-full border border-dashed border-cyan-400/20 arc-ring-reverse" />

            {/* Cyan Energy Field Glow */}
            <div className="absolute inset-4 rounded-full bg-cyan-400/5 blur-xl pointer-events-none" />

            {/* Segmented Tech Border Ring */}
            <div className="absolute inset-6 rounded-full border-2 border-cyan-400/40 shadow-[0_0_20px_rgba(0,212,255,0.2)]" />

            {/* Rotating Mechanical Core Blades */}
            <div className="absolute inset-10 rounded-full border border-cyan-300/30 arc-ring-reverse">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-3 bg-cyan-400 shadow-[0_0_8px_#00d4ff]" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-3 bg-cyan-400 shadow-[0_0_8px_#00d4ff]" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 w-3 bg-cyan-400 shadow-[0_0_8px_#00d4ff]" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 h-1.5 w-3 bg-cyan-400 shadow-[0_0_8px_#00d4ff]" />
            </div>

            {/* Inner Power Core: Interactive Push-to-Talk Button */}
            <button
              type="button"
              onClick={toggleVoiceListening}
              title={
                voiceStatus === 'listening'
                  ? 'Click to stop listening'
                  : 'Click to engage Voice Transcribing (J.A.R.V.I.S Listening Mode)'
              }
              className={`group relative flex h-36 w-36 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                isSpeaking
                  ? 'border-amber-300 bg-amber-950/70 shadow-[0_0_45px_rgba(251,191,36,0.7)] animate-pulse scale-105'
                  : voiceStatus === 'listening'
                  ? 'border-rose-400 bg-rose-950/60 shadow-[0_0_40px_rgba(244,63,94,0.6)] scale-105'
                  : voiceStatus === 'processing'
                  ? 'border-amber-400 bg-amber-950/60 shadow-[0_0_40px_rgba(251,191,36,0.6)] animate-pulse'
                  : 'border-cyan-400/80 bg-cyan-950/50 hover:border-cyan-300 hover:bg-cyan-900/60 hover:shadow-[0_0_35px_rgba(0,212,255,0.4)]'
              }`}
            >
              {/* Inner glowing triangle / reactor motif */}
              <div className="relative flex flex-col items-center justify-center">
                <div
                  className={`h-10 w-10 border-2 transition-transform duration-500 ${
                    isSpeaking
                      ? 'border-amber-300 rotate-45 scale-110'
                      : voiceStatus === 'listening'
                      ? 'border-rose-400 rotate-45 scale-110'
                      : 'border-cyan-300 rotate-45 group-hover:rotate-90'
                  }`}
                  style={{
                    boxShadow:
                      isSpeaking
                        ? '0 0 20px rgba(251,191,36,0.9)'
                        : voiceStatus === 'listening'
                        ? '0 0 15px rgba(244,63,94,0.8)'
                        : '0 0 15px rgba(0,212,255,0.5)',
                  }}
                />
                <span
                  className={`mt-3 font-hud text-[9px] font-bold uppercase tracking-[0.25em] ${
                    isSpeaking
                      ? 'text-amber-200 animate-pulse'
                      : voiceStatus === 'listening'
                      ? 'text-rose-300'
                      : voiceStatus === 'processing'
                      ? 'text-amber-300'
                      : 'text-cyan-200'
                  }`}
                >
                  {isSpeaking
                    ? 'SPEAKING'
                    : voiceStatus === 'listening'
                    ? 'RECORDING'
                    : voiceStatus === 'processing'
                    ? 'TRANSCRIBING'
                    : 'ENGAGE VOICE'}
                </span>
              </div>
            </button>
          </div>

          {/* ── Audio Frequency Visualizer Waves ── */}
          <div className="flex items-center justify-center gap-1 my-3 h-8">
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-150 ${
                  isSpeaking
                    ? 'bg-amber-300 wave-bar-pulse'
                    : voiceStatus === 'listening'
                    ? 'bg-rose-400 wave-bar-pulse'
                    : voiceStatus === 'processing'
                    ? 'bg-amber-400 wave-bar-pulse'
                    : 'bg-cyan-400/40'
                }`}
                style={{
                  height:
                    isSpeaking || voiceStatus === 'listening'
                      ? `${Math.max(6, Math.sin(i * 0.5) * 26 + 10)}px`
                      : '6px',
                  animationDelay: `${i * 45}ms`,
                }}
              />
            ))}
          </div>

          {/* ── Real-Time Transcription & Voice Stream Banner ── */}
          <div className="w-full max-w-xl hud-panel p-3 border border-cyan-400/35 bg-[#020a18]/95 shadow-[0_0_25px_rgba(0,212,255,0.12)]">
            <div className="flex items-center justify-between border-b border-cyan-400/15 pb-1 mb-2 font-mono-hud text-[9px]">
              <span className="text-cyan-400/80 uppercase tracking-widest flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                ACOUSTIC SPECTRUM // TRANSCRIPTION FEED
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">MIC: ACTIVE SENSORS</span>
                {isSpeaking && (
                  <span className="text-amber-300 font-bold flex items-center gap-1 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    VOCALIZING
                  </span>
                )}
              </div>
            </div>

            <div className="min-h-[44px] flex items-center justify-center px-3 py-1.5 bg-cyan-950/20 border border-cyan-400/10 rounded-sm">
              <p
                className={`text-center font-mono-hud text-xs ${
                  voiceStatus === 'listening'
                    ? 'text-rose-200 animate-pulse'
                    : transcribedText
                    ? 'text-cyan-200'
                    : 'text-slate-500'
                }`}
              >
                {transcribedText || 'Waiting for vocal command... Click Arc Reactor or speak.'}
              </p>
            </div>

            {/* Vocal Response Log & Tactical Intel Screen */}
            {speechFeedback && (
              <div className="mt-3 p-3 bg-gradient-to-b from-[#031527]/90 to-[#020d1c]/95 border border-cyan-400/30 rounded-sm shadow-[0_0_15px_rgba(0,212,255,0.08)]">
                <div className="flex items-center justify-between border-b border-cyan-400/20 pb-1.5 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="font-hud text-[11px] font-bold tracking-wider text-cyan-300 uppercase">
                      J.A.R.V.I.S INTEL STREAM
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono-hud text-[10px]">
                    <button
                      type="button"
                      onClick={() =>
                        speakJarvisVoice(speechFeedback, {
                          onStart: () => setIsSpeaking(true),
                          onEnd: () => setIsSpeaking(false),
                        })
                      }
                      className="px-2 py-0.5 border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/25 transition cursor-pointer"
                      title="Replay Voice Synthesis"
                    >
                      🔊 REPLAY
                    </button>
                    {isSpeaking && (
                      <button
                        type="button"
                        onClick={() => {
                          stopJarvisVoice();
                          setIsSpeaking(false);
                        }}
                        className="px-2 py-0.5 border border-rose-400/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/25 transition cursor-pointer"
                        title="Silence voice output"
                      >
                        ⏹ SILENCE
                      </button>
                    )}
                  </div>
                </div>

                {/* Formatted Content */}
                <div className="max-h-[240px] overflow-y-auto pr-1">
                  {renderJarvisIntel(speechFeedback)}
                </div>

                {/* Contextual Action Direct Navigation */}
                <div className="mt-2.5 pt-2 border-t border-cyan-400/15 flex flex-wrap items-center gap-2">
                  {speechFeedback.toLowerCase().includes('app') && (
                    <button
                      type="button"
                      onClick={() => onSwitchTab('apps')}
                      className="border border-cyan-400/50 bg-cyan-400/15 hover:bg-cyan-400/30 px-2.5 py-1 text-[10px] font-hud text-cyan-200 tracking-wider uppercase transition flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,212,255,0.2)] cursor-pointer"
                    >
                      <span>▶</span> OPEN PC APPS (170)
                    </button>
                  )}
                  {(speechFeedback.toLowerCase().includes('hardware') ||
                    speechFeedback.toLowerCase().includes('telemetry') ||
                    speechFeedback.toLowerCase().includes('cpu') ||
                    speechFeedback.toLowerCase().includes('gpu')) && (
                    <button
                      type="button"
                      onClick={() => onSwitchTab('telemetry')}
                      className="border border-cyan-400/50 bg-cyan-400/15 hover:bg-cyan-400/30 px-2.5 py-1 text-[10px] font-hud text-cyan-200 tracking-wider uppercase transition flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,212,255,0.2)] cursor-pointer"
                    >
                      <span>▶</span> OPEN HARDWARE TELEMETRY
                    </button>
                  )}
                  {pendingActions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onSwitchTab('approvals')}
                      className="border border-amber-400/60 bg-amber-400/20 hover:bg-amber-400/35 px-2.5 py-1 text-[10px] font-hud text-amber-200 tracking-wider uppercase transition flex items-center gap-1.5 shadow-[0_0_10px_rgba(245,158,11,0.2)] cursor-pointer"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                      REVIEW APPROVALS ({pendingActions.length})
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quick Command Direct Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (commandInput.trim()) {
                  executeCommand(commandInput.trim());
                }
              }}
              className="mt-3 flex items-center gap-2"
            >
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder="Or type instruction here, Sir..."
                className="flex-1 bg-black/40 border border-cyan-400/25 px-3 py-1.5 font-mono-hud text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="border border-cyan-400/40 bg-cyan-400/15 px-4 py-1.5 font-hud text-[10px] uppercase tracking-wider text-cyan-200 hover:bg-cyan-400/30 transition shadow-[0_0_10px_rgba(0,212,255,0.2)]"
              >
                Transmit
              </button>
            </form>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5">
              {[
                'Check PC apps and compatibility',
                'Analyze system CPU & RAM',
                'Write a python system monitor',
                'Run system diagnostics',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setCommandInput(preset);
                    executeCommand(preset);
                  }}
                  className="border border-cyan-400/15 bg-cyan-400/5 px-2 py-0.5 text-[9px] font-mono-hud text-cyan-300 hover:border-cyan-400 hover:bg-cyan-400/15 transition"
                >
                  ▶ {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right Holographic Windows: Security Gate & Command Terminal ── */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Tactical Security & Approval Gate Window (Pops open when pending approvals exist!) */}
          {showApprovalWindow && (
            <div
              className={`hud-panel p-3 border transition-all duration-300 ${
                pendingActions.length > 0
                  ? 'border-amber-400/60 bg-[#160d02]/95 shadow-[0_0_30px_rgba(245,158,11,0.25)]'
                  : 'border-cyan-400/20 bg-[#020a18]/90'
              }`}
            >
              <div className="flex items-center justify-between border-b border-amber-400/20 pb-1.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      pendingActions.length > 0 ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
                    }`}
                  />
                  <span
                    className={`font-hud text-[10px] font-bold uppercase tracking-[0.2em] ${
                      pendingActions.length > 0 ? 'text-amber-300' : 'text-cyan-300'
                    }`}
                  >
                    Security Gate
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`font-mono-hud text-[9px] px-1 rounded uppercase ${
                      pendingActions.length > 0
                        ? 'bg-amber-500/20 text-amber-300 font-bold'
                        : 'text-slate-500'
                    }`}
                  >
                    {pendingActions.length} PENDING
                  </span>
                  <button
                    onClick={() => setShowApprovalWindow(false)}
                    className="text-slate-500 hover:text-slate-300 text-xs px-1"
                  >
                    ×
                  </button>
                </div>
              </div>

              {pendingActions.length === 0 ? (
                <div className="py-4 text-center text-[10px] font-mono-hud text-slate-500">
                  🛡 All security clearances nominal.
                  <br />
                  No high-risk operations awaiting authorization.
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {pendingActions.map((action) => (
                    <div
                      key={action.id}
                      className="border border-amber-400/40 bg-amber-500/10 p-2.5 rounded-sm"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono-hud text-amber-300 font-semibold mb-1">
                        <span>⚡ {action.actionType.toUpperCase()}</span>
                        <span className="text-[9px] text-amber-400/80">CONFIRMATION REQ</span>
                      </div>
                      <p className="font-mono-hud text-[10px] text-slate-200 line-clamp-2 mb-2">
                        {action.description || 'Execution of shell or filesystem operation.'}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onApproveAction(action.id)}
                          className="flex-1 bg-amber-500/20 border border-amber-400/60 py-1 font-hud text-[9px] uppercase tracking-wider text-amber-200 hover:bg-amber-500/40 transition"
                        >
                          ✓ Authorize
                        </button>
                        <button
                          type="button"
                          onClick={() => onRejectAction(action.id)}
                          className="border border-slate-700 bg-black/40 px-2 py-1 font-hud text-[9px] uppercase tracking-wider text-slate-400 hover:text-rose-300 transition"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Holographic Terminal & Command Output Window */}
          {showTerminalWindow && (
            <div className="hud-panel p-3 border border-cyan-400/25 bg-[#020a18]/90">
              <div className="flex items-center justify-between border-b border-cyan-400/20 pb-1 mb-2">
                <span className="font-hud text-[10px] uppercase tracking-[0.2em] text-cyan-300 flex items-center gap-1.5">
                  <span className="text-cyan-400">⌨</span> Terminal Execution
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-mono-hud text-slate-500">
                    {commandRuns.length} runs
                  </span>
                  <button
                    onClick={() => setShowTerminalWindow(false)}
                    className="text-slate-500 hover:text-slate-300 text-xs px-1"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="font-mono-hud text-[10px] bg-black/60 p-2 border border-cyan-400/10 rounded-sm h-36 overflow-y-auto space-y-2">
                {commandRuns.length === 0 ? (
                  <div className="text-slate-600 italic">No shell processes spawned yet.</div>
                ) : (
                  commandRuns.slice(0, 3).map((run) => (
                    <div key={run.id} className="border-b border-cyan-400/10 pb-1">
                      <div className="text-cyan-300 truncate">$ {run.command}</div>
                      <div className="text-slate-400 text-[9px] line-clamp-2">
                        {run.stdout || run.stderr || `Exited with code ${run.exitCode ?? 0}`}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {project.folderPath && (
                <div className="mt-2 flex items-center justify-between pt-1 border-t border-cyan-400/10 text-[9px] font-mono-hud">
                  <span className="text-slate-500 truncate max-w-[150px]">{project.folderPath}</span>
                  <button
                    type="button"
                    onClick={() => (window as any).buildos?.openTerminal?.(project.folderPath!)}
                    className="text-cyan-300 hover:underline"
                  >
                    Open Shell ↗
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom HUD Control Bar: Toggle Window Buttons ── */}
      <div className="relative z-10 flex flex-wrap items-center justify-between border-t border-cyan-400/15 pt-3 mt-4">
        <div className="flex items-center gap-2">
          <span className="font-hud text-[9px] uppercase tracking-[0.2em] text-cyan-400/70">
            HOLOGRAPHIC WINDOWS:
          </span>
          <button
            type="button"
            onClick={() => setShowTasksWindow((prev) => !prev)}
            className={`border px-2.5 py-1 font-mono-hud text-[10px] uppercase tracking-wider transition ${
              showTasksWindow
                ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200'
                : 'border-slate-800 bg-slate-900/50 text-slate-500 hover:text-slate-300'
            }`}
          >
            📋 Operations {showTasksWindow ? '●' : '○'}
          </button>
          <button
            type="button"
            onClick={() => setShowTerminalWindow((prev) => !prev)}
            className={`border px-2.5 py-1 font-mono-hud text-[10px] uppercase tracking-wider transition ${
              showTerminalWindow
                ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200'
                : 'border-slate-800 bg-slate-900/50 text-slate-500 hover:text-slate-300'
            }`}
          >
            ⌨ Terminal {showTerminalWindow ? '●' : '○'}
          </button>
          <button
            type="button"
            onClick={() => setShowSpecsWindow((prev) => !prev)}
            className={`border px-2.5 py-1 font-mono-hud text-[10px] uppercase tracking-wider transition ${
              showSpecsWindow
                ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200'
                : 'border-slate-800 bg-slate-900/50 text-slate-500 hover:text-slate-300'
            }`}
          >
            ⚡ Diagnostics {showSpecsWindow ? '●' : '○'}
          </button>
          <button
            type="button"
            onClick={() => setShowApprovalWindow((prev) => !prev)}
            className={`border px-2.5 py-1 font-mono-hud text-[10px] uppercase tracking-wider transition ${
              showApprovalWindow
                ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                : 'border-slate-800 bg-slate-900/50 text-slate-500 hover:text-slate-300'
            }`}
          >
            🛡 Security Gate {showApprovalWindow ? '●' : '○'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {latestJarvisMessage && (
            <span className="font-body text-xs text-slate-400 truncate max-w-xs">
              Last status: "{latestJarvisMessage.content.slice(0, 40)}..."
            </span>
          )}
          {onSelectFolder && !project.folderPath && (
            <button
              type="button"
              onClick={onSelectFolder}
              className="border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 font-hud text-[9px] uppercase tracking-widest text-cyan-300 hover:bg-cyan-400/20 transition"
            >
              Attach Workspace Folder
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
