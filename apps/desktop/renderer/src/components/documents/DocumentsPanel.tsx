import ReactMarkdown from 'react-markdown';
import type { DocumentRecord } from '@buildos/shared/types';
import { Panel } from '../layout/Panel';

interface DocumentsPanelProps {
  documents: DocumentRecord[];
}

export const DocumentsPanel = ({ documents }: DocumentsPanelProps) => (
  <Panel title="Documents" subtitle="Generated PRD, architecture, and tech decisions.">
    <div className="h-full overflow-y-auto p-4">
      {documents.length === 0 ? (
        <p className="text-sm text-slate-400">Generated documents will appear here after planning agents run.</p>
      ) : (
        <div className="space-y-4">
          {documents.map((document) => (
            <article key={document.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{document.title}</h3>
                  <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">{document.type}</p>
                </div>
                <span className="text-xs text-slate-500">v{document.version}</span>
              </div>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{document.content}</ReactMarkdown>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  </Panel>
);
