import type {
  ActionProposal,
  AppSettings,
  CommandRunRecord,
  DocumentRecord,
  FileTreeNode,
  MessageRecord,
  ProjectRecord,
  TaskRecord,
} from '@buildos/shared/types';

export interface WorkspaceState {
  projects: ProjectRecord[];
  activeProject: ProjectRecord | null;
  fileTree: FileTreeNode[];
  selectedFilePath: string | null;
  selectedFileContent: string;
  messages: MessageRecord[];
  documents: DocumentRecord[];
  tasks: TaskRecord[];
  pendingActions: ActionProposal[];
  commandRuns: CommandRunRecord[];
  commandInput: string;
  logs: string[];
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
}
