import { useMemo, useState } from 'react';

interface DiffViewerProps {
  beforeContent: string;
  afterContent: string;
}

interface DiffLine {
  type: 'add' | 'remove' | 'normal';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

const computeLineDiff = (before: string, after: string): DiffLine[] => {
  const beforeLines = before ? before.split(/\r?\n/) : [];
  const afterLines = after ? after.split(/\r?\n/) : [];

  if (beforeLines.length === 0) {
    return afterLines.map((line, idx) => ({
      type: 'add',
      newLineNumber: idx + 1,
      content: line,
    }));
  }

  const diff: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < beforeLines.length || j < afterLines.length) {
    if (i < beforeLines.length && j < afterLines.length && beforeLines[i] === afterLines[j]) {
      diff.push({
        type: 'normal',
        oldLineNumber: i + 1,
        newLineNumber: j + 1,
        content: beforeLines[i],
      });
      i++;
      j++;
    } else if (j < afterLines.length && !beforeLines.slice(i, i + 10).includes(afterLines[j])) {
      diff.push({
        type: 'add',
        newLineNumber: j + 1,
        content: afterLines[j],
      });
      j++;
    } else if (i < beforeLines.length) {
      diff.push({
        type: 'remove',
        oldLineNumber: i + 1,
        content: beforeLines[i],
      });
      i++;
    } else {
      diff.push({
        type: 'add',
        newLineNumber: j + 1,
        content: afterLines[j],
      });
      j++;
    }
  }

  return diff;
};

export const DiffViewer = ({ beforeContent, afterContent }: DiffViewerProps) => {
  const [viewMode, setViewMode] = useState<'diff' | 'raw'>('diff');
  const diffLines = useMemo(() => computeLineDiff(beforeContent, afterContent), [beforeContent, afterContent]);

  const addedCount = diffLines.filter((l) => l.type === 'add').length;
  const removedCount = diffLines.filter((l) => l.type === 'remove').length;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/90 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="text-emerald-400">+{addedCount}</span>
          <span className="text-rose-400">-{removedCount}</span>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-900 p-0.5 border border-white/5">
          <button
            type="button"
            onClick={() => setViewMode('diff')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
              viewMode === 'diff' ? 'bg-amber-300/20 text-amber-200' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Diff View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('raw')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
              viewMode === 'raw' ? 'bg-amber-300/20 text-amber-200' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Full File Preview
          </button>
        </div>
      </div>

      {viewMode === 'raw' ? (
        <pre className="max-h-56 overflow-y-auto font-mono text-slate-300 whitespace-pre-wrap">{afterContent}</pre>
      ) : (
        <div className="max-h-56 overflow-y-auto font-mono rounded-lg border border-white/5 bg-slate-950/50">
          {diffLines.map((line, idx) => (
            <div
              key={idx}
              className={`flex items-start px-2 py-0.5 leading-relaxed font-mono ${
                line.type === 'add'
                  ? 'bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500'
                  : line.type === 'remove'
                  ? 'bg-rose-950/40 text-rose-300 border-l-2 border-rose-500'
                  : 'text-slate-400 border-l-2 border-transparent'
              }`}
            >
              <span className="w-6 select-none opacity-40 text-right pr-2 text-[10px]">
                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
              </span>
              <span className="flex-1 whitespace-pre-wrap break-all">{line.content || ' '}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
