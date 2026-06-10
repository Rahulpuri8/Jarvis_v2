import type { ActionProposal, CommandRunRecord, FileTreeNode, MessageRecord, ProjectRecord, TaskRecord, DocumentRecord } from '@buildos/shared/types';
import { ApprovalPanel } from '../components/approvals/ApprovalPanel';
import { ChatPanel } from '../components/chat/ChatPanel';
import { DocumentsPanel } from '../components/documents/DocumentsPanel';
import { FileTreePanel } from '../components/file-tree/FileTreePanel';
import { ActionLogPanel } from '../components/logs/ActionLogPanel';
import { TaskBoardPanel } from '../components/tasks/TaskBoardPanel';

interface WorkspacePageProps {
  project: ProjectRecord;
  fileTree: FileTreeNode[];
  selectedFilePath: string | null;
  selectedFileContent: string;
  messages: MessageRecord[];
  documents: DocumentRecord[];
  tasks: TaskRecord[];
  pendingActions: ActionProposal[];
  commandRuns: CommandRunRecord[];
  logs: string[];
  onSelectFolder: () => Promise<void>;
  onOpenFile: (path: string, explicitApproval?: boolean) => Promise<void>;
  onSendMessage: (content: string) => Promise<void>;
  onGenerateStarterFiles: () => Promise<void>;
  onApproveAction: (actionId: string) => Promise<void>;
  onRejectAction: (actionId: string) => Promise<void>;
  onProposeCommand: (command: string) => Promise<void>;
  onOpenSettings: () => void;
}

export const WorkspacePage = ({
  project,
  fileTree,
  selectedFilePath,
  selectedFileContent,
  messages,
  documents,
  tasks,
  pendingActions,
  commandRuns,
  logs,
  onSelectFolder,
  onOpenFile,
  onSendMessage,
  onGenerateStarterFiles,
  onApproveAction,
  onRejectAction,
  onProposeCommand,
  onOpenSettings,
}: WorkspacePageProps) => (
  <div className="flex min-h-screen flex-col bg-[linear-gradient(180deg,_#020617,_#0f172a_40%,_#111827)] text-slate-100">
    <header className="border-b border-white/10 px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200">BuildOS AI Workspace</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{project.name}</h1>
          <p className="text-sm text-slate-400">{project.folderPath ?? 'No folder selected yet.'}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void onSelectFolder()}
            className="rounded-full border border-cyan-300/30 px-4 py-2 text-sm text-cyan-200 transition hover:bg-cyan-300/10"
          >
            Select Local Folder
          </button>
          <button
            type="button"
            onClick={() => (project.folderPath ? void window.buildos.openInVSCode(project.folderPath) : undefined)}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
          >
            Open in VS Code
          </button>
          <button
            type="button"
            onClick={() => (project.folderPath ? void window.buildos.openBrowserUrl('https://ai.google.dev') : undefined)}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
          >
            Open Browser URL
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => void onGenerateStarterFiles()}
            className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Propose Starter Files
          </button>
        </div>
      </div>
    </header>
    <main className="grid flex-1 grid-cols-[300px_minmax(0,1.15fr)_420px] grid-rows-[minmax(0,1fr)_260px] gap-4 p-4">
      <div className="row-span-2 min-h-0">
        <FileTreePanel
          fileTree={fileTree}
          selectedFilePath={selectedFilePath}
          selectedFileContent={selectedFileContent}
          onOpenFile={onOpenFile}
        />
      </div>
      <div className="min-h-0">
        <ChatPanel messages={messages} onSend={onSendMessage} />
      </div>
      <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <DocumentsPanel documents={documents} />
        <TaskBoardPanel tasks={tasks} />
      </div>
      <div className="min-h-0">
        <ApprovalPanel pendingActions={pendingActions} onApprove={onApproveAction} onReject={onRejectAction} />
      </div>
      <div className="min-h-0">
        <ActionLogPanel
          commandRuns={commandRuns}
          projectFolderPath={project.folderPath}
          onProposeCommand={onProposeCommand}
          logs={logs}
        />
      </div>
    </main>
  </div>
);
