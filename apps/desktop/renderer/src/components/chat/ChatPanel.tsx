import { useState, useEffect, useRef } from 'react';
import type { MessageRecord, ActionProposal } from '@buildos/shared/types';
import { Panel } from '../layout/Panel';
import { VoiceModeButton } from './VoiceModeButton';

interface ChatPanelProps {
  messages: MessageRecord[];
  onSend: (content: string) => Promise<void>;
  pendingActions?: ActionProposal[];
  onApproveAction?: (actionId: string) => Promise<void>;
  onRejectAction?: (actionId: string) => Promise<void>;
  loading?: boolean;
  activeTaskLabel?: string | null;
}

const renderFormattedContent = (content: string) => {
  const lines = content.split('\n');
  return lines.map((line, lIdx) => {
    const parts: (string | JSX.Element)[] = [];
    const tokenRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\))|(\*\*([^*]+)\*\*)/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    let keyCounter = 0;

    while ((match = tokenRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      if (match[1]) {
        const label = match[2];
        const href = match[3];
        parts.push(
          <a
            key={`link-${lIdx}-${keyCounter++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 font-medium underline decoration-cyan-400/40 underline-offset-2 hover:text-cyan-300 hover:decoration-cyan-300 transition-colors"
          >
            {label}
          </a>
        );
      } else if (match[4]) {
        const boldText = match[5];
        parts.push(
          <strong key={`bold-${lIdx}-${keyCounter++}`} className="font-semibold text-slate-100">
            {boldText}
          </strong>
        );
      }
      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    return (
      <div key={`line-${lIdx}`} className={line.trim() === '' ? 'h-2' : 'min-h-[1.4rem]'}>
        {parts.length > 0 ? parts : <span>&nbsp;</span>}
      </div>
    );
  });
};

/* ── Thinking Indicator Component ── */
const ThinkingIndicator = ({ taskLabel }: { taskLabel?: string | null }) => (
  <div className="hud-boot px-4 py-3 jarvis-msg" style={{ animationDelay: '0ms' }}>
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <span className="font-hud text-[9px] uppercase tracking-[0.3em] text-cyan-400/70">
        ◈ J.A.R.V.I.S
      </span>
      <span className="font-mono-hud text-[9px] text-slate-600">
        {new Date().toLocaleTimeString()}
      </span>
    </div>
    <div className="flex items-center gap-3">
      {/* Pulsing Arc Reactor Mini */}
      <div className="relative flex items-center justify-center">
        <div
          className="h-5 w-5 rounded-full border border-cyan-400/60 animate-ping"
          style={{ animationDuration: '1.5s' }}
        />
        <div
          className="absolute h-3 w-3 rounded-full bg-cyan-400/40 animate-pulse"
          style={{ animationDuration: '0.8s' }}
        />
        <div className="absolute h-1.5 w-1.5 rounded-full bg-cyan-300" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-body text-sm text-cyan-300 animate-pulse">Processing</span>
          <span className="font-body text-sm text-slate-400">
            {/* Animated dots */}
            <span className="inline-block animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }}>.</span>
            <span className="inline-block animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1s' }}>.</span>
            <span className="inline-block animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1s' }}>.</span>
          </span>
        </div>
        {taskLabel && (
          <div className="font-mono-hud text-[10px] text-slate-500 mt-0.5 truncate max-w-[300px]">
            ◈ {taskLabel}
          </div>
        )}
      </div>
    </div>
    {/* Progress bar animation */}
    <div className="mt-2 h-[2px] w-full bg-slate-800/60 overflow-hidden rounded-full">
      <div
        className="h-full bg-gradient-to-r from-cyan-400/80 via-cyan-300 to-cyan-400/80 rounded-full"
        style={{
          width: '30%',
          animation: 'thinkingSlide 1.5s ease-in-out infinite',
        }}
      />
    </div>
    <style>{`
      @keyframes thinkingSlide {
        0% { transform: translateX(-100%); width: 30%; }
        50% { transform: translateX(200%); width: 40%; }
        100% { transform: translateX(-100%); width: 30%; }
      }
    `}</style>
  </div>
);

export const ChatPanel = ({
  messages,
  onSend,
  pendingActions,
  onApproveAction,
  onRejectAction,
  loading,
  activeTaskLabel,
}: ChatPanelProps) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const quickPrompts = [
    'What capabilities are currently online, Jarvis?',
    'Check Ollama status and loaded models',
    'Write a Python script to monitor system CPU and RAM',
    'Help me create a new project',
  ];

  return (
    <Panel title="Neural Interface" subtitle="COMM LINK // J.A.R.V.I.S AGENT CORE" status="online">
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && !loading ? (
            <div className="hud-boot flex flex-col items-center justify-center gap-4 py-8">
              <div className="flex items-center gap-2">
                <div className="h-px w-10 bg-gradient-to-r from-transparent to-cyan-400/40" />
                <span className="font-hud text-[10px] uppercase tracking-[0.35em] text-cyan-400/60">System Ready</span>
                <div className="h-px w-10 bg-gradient-to-l from-transparent to-cyan-400/40" />
              </div>
              <p className="font-body text-base text-slate-300 text-center max-w-md">
                Good morning, Sir. I am online and standing by. How may I assist you with your tasks today?
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2 max-w-lg">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setInput(prompt);
                      void onSend(prompt);
                    }}
                    className="border border-cyan-400/25 bg-cyan-400/5 px-3 py-1.5 font-mono-hud text-[11px] text-cyan-300 transition hover:border-cyan-400 hover:bg-cyan-400/15 hover:shadow-[0_0_10px_rgba(0,212,255,0.15)]"
                  >
                    ▶ {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {messages.map((message, idx) => (
            <article
              key={message.id}
              className={`hud-boot px-4 py-3 ${
                message.role === 'user' ? 'user-msg' : 'jarvis-msg'
              }`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className={`font-hud text-[9px] uppercase tracking-[0.3em] ${
                  message.role === 'user' ? 'text-amber-400/70' : 'text-cyan-400/70'
                }`}>
                  {message.role === 'user' ? '◉ Sir' : `◈ ${message.agentName || 'J.A.R.V.I.S'}`}
                </span>
                <span className="font-mono-hud text-[9px] text-slate-600">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="font-body text-sm leading-6 text-slate-200 space-y-1">
                {renderFormattedContent(message.content)}
              </div>
            </article>
          ))}

          {/* ── Thinking / Loading Indicator ── */}
          {loading && <ThinkingIndicator taskLabel={activeTaskLabel} />}

          {/* Auto-scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Direct In-Chat Authorization Alert ── */}
        {pendingActions && pendingActions.length > 0 && (
          <div className="mx-4 mb-2 p-3 border border-amber-400/60 bg-[#160d02] shadow-[0_0_20px_rgba(245,158,11,0.2)] rounded-sm">
            <div className="flex items-center justify-between font-mono-hud text-[10px] text-amber-300 font-bold mb-1.5">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                ⚠️ AUTHORIZATION REQUIRED // DANGEROUS ACTION PROPOSAL
              </span>
              <span>{pendingActions.length} PENDING APPROVAL</span>
            </div>
            <div className="space-y-2 mt-2">
              {pendingActions.map((action) => (
                <div
                  key={action.id}
                  className="border border-amber-400/30 bg-amber-500/10 p-2 text-xs font-mono-hud flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="truncate flex-1 min-w-[200px]">
                    <span className="text-amber-200 font-semibold uppercase">[{action.actionType}]</span>{' '}
                    <span className="text-slate-200">{action.description || 'Execution awaiting authorization'}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {onApproveAction && (
                      <button
                        type="button"
                        onClick={() => void onApproveAction(action.id)}
                        className="bg-amber-400/20 border border-amber-400/60 px-3 py-1 font-hud text-[9px] uppercase tracking-wider text-amber-200 hover:bg-amber-400/40 transition"
                      >
                        ✓ Authorize & Run
                      </button>
                    )}
                    {onRejectAction && (
                      <button
                        type="button"
                        onClick={() => void onRejectAction(action.id)}
                        className="border border-slate-700 bg-black/40 px-2 py-1 font-hud text-[9px] uppercase tracking-wider text-slate-400 hover:text-rose-300 transition"
                      >
                        ✕ Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <form
          className="border-t border-cyan-400/10 p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!input.trim()) return;
            await onSend(input.trim());
            setInput('');
          }}
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={3}
            className="w-full border border-cyan-400/15 bg-transparent px-4 py-3 font-body text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40 focus:shadow-[0_0_12px_rgba(0,212,255,0.08)]"
            placeholder="Enter command, Sir..."
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono-hud text-[9px] uppercase tracking-[0.2em] text-slate-600">
              {loading ? (
                <span className="text-cyan-400 animate-pulse">◈ Processing task...</span>
              ) : (
                'Approval-gated execution active'
              )}
            </span>
            <div className="flex items-center gap-3">
              <VoiceModeButton
                onTranscribed={(text) => {
                  setInput((prev) => (prev ? `${prev} ${text}` : text));
                }}
              />
              <button
                type="submit"
                disabled={loading}
                className={`group flex items-center gap-2 border border-cyan-400/40 bg-cyan-400/10 px-5 py-2 font-hud text-[10px] uppercase tracking-[0.25em] text-cyan-300 transition hover:bg-cyan-400/20 hover:shadow-[0_0_15px_rgba(0,212,255,0.12)] ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                {loading ? 'Processing...' : 'Transmit'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Panel>
  );
};
