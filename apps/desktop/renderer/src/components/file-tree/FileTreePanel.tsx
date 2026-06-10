import type { FileTreeNode } from '@buildos/shared/types';
import { Panel } from '../layout/Panel';

interface FileTreePanelProps {
  fileTree: FileTreeNode[];
  selectedFilePath: string | null;
  selectedFileContent: string;
  onOpenFile: (path: string, explicitApproval?: boolean) => Promise<void>;
}

const TreeNodeView = ({
  node,
  depth,
  onOpenFile,
}: {
  node: FileTreeNode;
  depth: number;
  onOpenFile: (path: string, explicitApproval?: boolean) => Promise<void>;
}) => (
  <div>
    <button
      type="button"
      onClick={() => (node.type === 'file' ? onOpenFile(node.path) : undefined)}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition ${
        node.type === 'file' ? 'hover:bg-white/5' : 'cursor-default text-slate-300'
      }`}
      style={{ paddingLeft: `${depth * 14 + 12}px` }}
    >
      <span className={node.type === 'directory' ? 'text-cyan-300' : node.protected ? 'text-amber-300' : 'text-slate-400'}>
        {node.type === 'directory' ? 'DIR' : node.protected ? 'PROTECTED' : 'FILE'}
      </span>
      <span className="truncate text-slate-200">{node.name}</span>
    </button>
    {node.children?.map((child) => (
      <TreeNodeView key={child.path} node={child} depth={depth + 1} onOpenFile={onOpenFile} />
    ))}
  </div>
);

export const FileTreePanel = ({
  fileTree,
  selectedFilePath,
  selectedFileContent,
  onOpenFile,
}: FileTreePanelProps) => (
  <Panel title="Selected Folder" subtitle="Safe tree view with ignored folders and protected-file boundaries.">
    <div className="grid h-full min-h-0 grid-rows-[1fr_1fr] gap-0">
      <div className="overflow-y-auto border-b border-white/10 p-4">
        {fileTree.length === 0 ? (
          <p className="text-sm text-slate-400">Select a folder to view the project tree.</p>
        ) : (
          fileTree.map((node) => <TreeNodeView key={node.path} node={node} depth={0} onOpenFile={onOpenFile} />)
        )}
      </div>
      <div className="overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-[0.18em] text-slate-400">Preview</h3>
          <span className="text-xs text-slate-500">{selectedFilePath ?? 'No file selected'}</span>
        </div>
        <pre className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950/90 p-4 text-xs leading-6 text-slate-300">
          {selectedFileContent || 'Choose a safe file from the tree to preview it here.'}
        </pre>
      </div>
    </div>
  </Panel>
);
