import { useEffect, useState } from 'react';
import type { AppSettings, ProjectRecord } from '@buildos/shared/types';
import type { WorkspaceState } from '../types/view-models';

const hasDesktopApi = () => typeof window !== 'undefined' && typeof window.buildos !== 'undefined';

const initialState: WorkspaceState = {
  projects: [],
  activeProject: null,
  fileTree: [],
  selectedFilePath: null,
  selectedFileContent: '',
  messages: [],
  documents: [],
  tasks: [],
  pendingActions: [],
  commandRuns: [],
  commandInput: '',
  logs: [],
  settings: null,
  loading: false,
  error: null,
};

export const useBuildOS = () => {
  const [state, setState] = useState<WorkspaceState>(initialState);

  const addLog = (message: string) =>
    setState((current) => ({
      ...current,
      logs: [`${new Date().toLocaleTimeString()}: ${message}`, ...current.logs].slice(0, 150),
    }));

  const loadProjects = async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    if (!hasDesktopApi()) {
      setState((current) => ({
        ...current,
        loading: false,
        error: 'Browser preview mode detected. Open the Electron desktop window to create projects and use local folder features.',
      }));
      return;
    }

    try {
      const [projects, settings] = await Promise.all([window.buildos.listProjects(), window.buildos.getSettings()]);
      setState((current) => ({ ...current, projects, settings, loading: false }));
      addLog(`Loaded ${projects.length} saved project(s).`);
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'Failed to load projects.' }));
    }
  };

  const createProject = async (payload: { name: string; description: string }) => {
    if (!hasDesktopApi()) {
      throw new Error('Create Workspace only works in the Electron desktop window, not the localhost browser preview.');
    }

    const project = (await window.buildos.createProject({
      ...payload,
      folderPath: null,
    })) as ProjectRecord;

    setState((current) => ({
      ...current,
      projects: [project, ...current.projects],
      activeProject: project,
    }));
    addLog(`Created project "${project.name}".`);
    return project;
  };

  const selectProject = async (project: ProjectRecord) => {
    if (!hasDesktopApi()) {
      return;
    }

    setState((current) => ({ ...current, activeProject: project, loading: true }));

    const [fileTree, messages, documents, tasks, pendingActions, commandRuns] = await Promise.all([
      project.folderPath ? window.buildos.getProjectTree(project.id) : Promise.resolve([]),
      window.buildos.getMessages(project.id),
      window.buildos.getDocuments(project.id),
      window.buildos.getTasks(project.id),
      window.buildos.getPendingActions(project.id),
      window.buildos.getCommandRuns(project.id),
    ]);

    setState((current) => ({
      ...current,
      activeProject: project,
      fileTree,
      messages,
      documents,
      tasks,
      pendingActions,
      commandRuns,
      loading: false,
    }));
    addLog(`Opened project "${project.name}".`);
  };

  const refreshProjectData = async (project: ProjectRecord) => {
    if (!hasDesktopApi()) {
      return;
    }

    const [fileTree, messages, documents, tasks, pendingActions, commandRuns] = await Promise.all([
      project.folderPath ? window.buildos.getProjectTree(project.id) : Promise.resolve([]),
      window.buildos.getMessages(project.id),
      window.buildos.getDocuments(project.id),
      window.buildos.getTasks(project.id),
      window.buildos.getPendingActions(project.id),
      window.buildos.getCommandRuns(project.id),
    ]);

    setState((current) => ({
      ...current,
      fileTree,
      messages,
      documents,
      tasks,
      pendingActions,
      commandRuns,
    }));
  };

  const selectFolder = async () => {
    if (!state.activeProject || !hasDesktopApi()) {
      return;
    }

    const folderPath = (await window.buildos.selectProjectFolder(state.activeProject.id)) as string | null;
    if (!folderPath) {
      return;
    }

    const updatedProject = {
      ...state.activeProject,
      folderPath,
    };

    const fileTree = await window.buildos.getProjectTree(updatedProject.id);
    setState((current) => ({
      ...current,
      projects: current.projects.map((project) => (project.id === updatedProject.id ? updatedProject : project)),
      activeProject: updatedProject,
      fileTree,
    }));
    addLog(`Selected folder ${folderPath}.`);
  };

  const openFile = async (relativePath: string, explicitApproval = false) => {
    if (!state.activeProject || !hasDesktopApi()) {
      return;
    }

    try {
      const content = await window.buildos.getFileContent({
        projectId: state.activeProject.id,
        relativePath,
        explicitApproval,
      });

      setState((current) => ({
        ...current,
        selectedFilePath: relativePath,
        selectedFileContent: content,
      }));
      addLog(`Read file ${relativePath}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open file.';
      setState((current) => ({
        ...current,
        selectedFilePath: relativePath,
        selectedFileContent: message,
      }));
      addLog(`Blocked file read for ${relativePath}.`);
    }
  };

  const sendMessage = async (content: string) => {
    if (!state.activeProject || !hasDesktopApi()) {
      return;
    }

    try {
      addLog('Orchestrator started chat analysis.');
      const result = await window.buildos.sendChatMessage({
        projectId: state.activeProject.id,
        content,
      });

      setState((current) => ({
        ...current,
        messages: result.messages,
        documents: result.documents,
        tasks: result.tasks,
        pendingActions: result.pendingActions,
        commandRuns: result.commandRuns,
      }));
      addLog('Agent pipeline completed.');
    } catch (error) {
      addLog(error instanceof Error ? error.message : 'Chat pipeline failed.');
    }
  };

  const generateStarterFiles = async () => {
    if (!state.activeProject || !hasDesktopApi()) {
      return;
    }

    await window.buildos.generateStarterFileProposals(state.activeProject.id);
    await refreshProjectData(state.activeProject);
    addLog('Generated starter file proposals.');
  };

  const approveAction = async (actionId: string) => {
    if (!state.activeProject || !hasDesktopApi()) {
      return;
    }

    const action = state.pendingActions.find((item) => item.id === actionId);
    if (action?.actionType === 'COMMAND') {
      const result = await window.buildos.runApprovedCommand({
        projectId: state.activeProject.id,
        actionId,
      });

      setState((current) => ({
        ...current,
        pendingActions: result.pendingActions,
        commandRuns: result.commandRuns,
      }));
      addLog(`Executed approved command action ${actionId}.`);
      return;
    }

    const result = await window.buildos.approveFileWrite({
      projectId: state.activeProject.id,
      actionId,
    });

    setState((current) => ({
      ...current,
      fileTree: result.tree,
      pendingActions: result.pendingActions,
    }));
    addLog(`Approved file action ${actionId}.`);
  };

  const rejectAction = async (actionId: string) => {
    if (!state.activeProject || !hasDesktopApi()) {
      return;
    }

    const pendingActions = await window.buildos.rejectFileWrite({
      projectId: state.activeProject.id,
      actionId,
    });

    setState((current) => ({
      ...current,
      pendingActions,
    }));
    addLog(`Rejected action ${actionId}.`);
  };

  const proposeCommand = async (command: string) => {
    if (!state.activeProject || !hasDesktopApi()) {
      return;
    }

    const result = await window.buildos.proposeCommand({
      projectId: state.activeProject.id,
      command,
    });

    setState((current) => ({
      ...current,
      pendingActions: result.pendingActions,
      commandRuns: result.commandRuns,
      commandInput: '',
    }));
    addLog(`Proposed command: ${command}`);
  };

  const saveSettings = async (settings: AppSettings) => {
    if (!hasDesktopApi()) {
      throw new Error('Settings persistence only works in the Electron desktop window.');
    }

    const saved = (await window.buildos.saveSettings(settings)) as AppSettings;
    setState((current) => ({
      ...current,
      settings: saved,
    }));
    addLog('Saved settings.');
    return saved;
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  return {
    state,
    loadProjects,
    createProject,
    selectProject,
    selectFolder,
    openFile,
    sendMessage,
    generateStarterFiles,
    approveAction,
    rejectAction,
    proposeCommand,
    saveSettings,
    addLog,
    setState,
  };
};
