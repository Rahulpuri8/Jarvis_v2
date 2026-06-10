import { useState } from 'react';
import type { MessageRecord } from '@buildos/shared/types';
import { Panel } from '../layout/Panel';

interface ChatPanelProps {
  messages: MessageRecord[];
  onSend: (content: string) => Promise<void>;
}

export const ChatPanel = ({ messages, onSend }: ChatPanelProps) => {
  const [input, setInput] = useState("Let's build an AI email assistant that checks my important emails, drafts replies, and asks me before sending.");

  return (
    <Panel title="AI Workspace" subtitle="Talk to the orchestrator and specialist agents.">
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-400/5 p-4 text-sm text-slate-300">
              Start with a build command, codebase review, PRD request, or folder explanation prompt.
            </div>
          ) : null}
          {messages.map((message) => (
            <article
              key={message.id}
              className={`rounded-2xl border px-4 py-3 ${
                message.role === 'user'
                  ? 'border-cyan-400/30 bg-cyan-400/10 text-slate-100'
                  : 'border-white/10 bg-slate-950/70 text-slate-200'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                <span>{message.role === 'user' ? 'You' : message.agentName}</span>
                <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{message.content}</pre>
            </article>
          ))}
        </div>
        <form
          className="border-t border-white/10 p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!input.trim()) {
              return;
            }
            await onSend(input.trim());
            setInput('');
          }}
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
            placeholder="Ask BuildOS AI to review a folder, generate a PRD, explain code, or build a new project."
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-500">Writes and commands stay approval-gated.</p>
            <button
              type="submit"
              className="rounded-full bg-cyan-300 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Send Command
            </button>
          </div>
        </form>
      </div>
    </Panel>
  );
};
