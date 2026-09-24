import { contextBridge, ipcRenderer } from 'electron';

const api = {
  listProjects: () => ipcRenderer.invoke('projects:list'),
  createProject: (payload: { name: string; description: string; folderPath: string | null }) =>
    ipcRenderer.invoke('projects:create', payload),
  selectProjectFolder: (projectId: string) => ipcRenderer.invoke('projects:select-folder', projectId),
  getProjectTree: (projectId: string) => ipcRenderer.invoke('projects:tree', projectId),
  getFileContent: (payload: { projectId: string; relativePath: string; explicitApproval?: boolean }) =>
    ipcRenderer.invoke('projects:file-content', payload),
  getMessages: (projectId: string) => ipcRenderer.invoke('projects:messages', projectId),
  getDocuments: (projectId: string) => ipcRenderer.invoke('projects:documents', projectId),
  getTasks: (projectId: string) => ipcRenderer.invoke('projects:tasks', projectId),
  getPendingActions: (projectId: string) => ipcRenderer.invoke('projects:pending-actions', projectId),
  getCommandRuns: (projectId: string) => ipcRenderer.invoke('projects:command-runs', projectId),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),
  sendChatMessage: (payload: { projectId: string; content: string }) => ipcRenderer.invoke('chat:send', payload),
  proposeFileWrite: (payload: { projectId: string; relativePath: string; content: string; description: string }) =>
    ipcRenderer.invoke('files:propose-write', payload),
  generateStarterFileProposals: (projectId: string) => ipcRenderer.invoke('files:generate-starter-proposals', projectId),
  approveFileWrite: (payload: { projectId: string; actionId: string }) => ipcRenderer.invoke('files:approve-write', payload),
  rejectFileWrite: (payload: { projectId: string; actionId: string }) => ipcRenderer.invoke('files:reject-write', payload),
  classifyCommand: (command: string) => ipcRenderer.invoke('commands:classify', command),
  proposeCommand: (payload: { projectId: string; command: string }) => ipcRenderer.invoke('commands:propose', payload),
  runApprovedCommand: (payload: { projectId: string; actionId: string }) =>
    ipcRenderer.invoke('commands:run-approved', payload),
  openInVSCode: (folderPath: string) => ipcRenderer.invoke('workspace:open-vscode', folderPath),
  openTerminal: (folderPath: string) => ipcRenderer.invoke('workspace:open-terminal', folderPath),
  openBrowserUrl: (url: string) => ipcRenderer.invoke('workspace:open-browser-url', url),
  executeTool: (request: unknown) => ipcRenderer.invoke('tools:execute', request),
  listTools: (category?: string) => ipcRenderer.invoke('tools:list', category),
  getToolStatus: () => ipcRenderer.invoke('tools:status'),
  getTokenAnalytics: () => ipcRenderer.invoke('settings:get-analytics'),
  getSystemDiagnostics: () => ipcRenderer.invoke('system:diagnostics'),
  listDesktopApps: () => ipcRenderer.invoke('system:list-apps'),
  getSystemSpecs: () => ipcRenderer.invoke('system:specs'),
};

contextBridge.exposeInMainWorld('buildos', api);


export type BuildOSDesktopApi = typeof api;
