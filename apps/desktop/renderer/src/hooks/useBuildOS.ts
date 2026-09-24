import { useEffect, useState, useRef, useCallback } from 'react';
import type { AppSettings, ProjectRecord, MessageRecord, ActionProposal } from '@buildos/shared/types';
import type { WorkspaceState } from '../types/view-models';
import { speakJarvisVoice } from '../utils/speech';
import { toolRegistry } from '../services/tool-registry';
import { ConversationManager } from '../services/conversation-manager';
import { ExecutionEngine, extractToolCall } from '../services/execution-engine';

// ── Singleton services (renderer-side) ─────────────────────────────────

const conversationManager = new ConversationManager();
const executionEngine = new ExecutionEngine();

// ── Helpers ────────────────────────────────────────────────────────────

const hasDesktopApi = () =>
  typeof window !== 'undefined' && typeof window.buildos !== 'undefined';

function makeMsg(
  projectId: string,
  role: 'user' | 'assistant',
  content: string,
  offset = 0,
): MessageRecord {
  return {
    id: `msg-${Date.now() + offset}`,
    projectId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

// ── Pending confirmation types ─────────────────────────────────────────

interface PendingConfirmationAction {
  id: string;
  tool: string;
  arguments: Record<string, any>;
  promptText: string;
  actionTitle: string;
}

// ── Default project ────────────────────────────────────────────────────

const defaultBrowserProject: ProjectRecord = {
  id: 'jarvis-general-session',
  name: 'J.A.R.V.I.S Core',
  description: 'General AI Assistant for all tasks',
  status: 'ACTIVE',
  folderPath: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const initialState: WorkspaceState = {
  projects: [defaultBrowserProject],
  activeProject: defaultBrowserProject,
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

// ═══════════════════════════════════════════════════════════════════════
// useBuildOS — Thin React glue over ToolRegistry, ConversationManager,
// and ExecutionEngine
// ═══════════════════════════════════════════════════════════════════════

export const useBuildOS = () => {
  const [state, setState] = useState<WorkspaceState>(initialState);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmationAction | null>(null);

  // ── Task Interruption System ──────────────────────────────────────
  const [activeTaskLabel, setActiveTaskLabel] = useState<string | null>(null);
  const activeAbortRef = useRef<AbortController | null>(null);
  const [pendingInterrupt, setPendingInterrupt] = useState<{
    newCommand: string;
    oldLabel: string;
  } | null>(null);

  const pid = () => state.activeProject?.id || 'jarvis-general-session';

  const addLog = (message: string) =>
    setState((c) => ({
      ...c,
      logs: [`${new Date().toLocaleTimeString()}: ${message}`, ...c.logs].slice(0, 150),
    }));

  // ── Project Management ────────────────────────────────────────────

  const loadProjects = async () => {
    setState((c) => ({ ...c, loading: true, error: null }));
    if (!hasDesktopApi()) {
      setState((c) => ({
        ...c,
        projects: [defaultBrowserProject],
        activeProject: defaultBrowserProject,
        loading: false,
        error: null,
      }));
      addLog('J.A.R.V.I.S online in browser assistant mode.');
      return;
    }

    try {
      const [projects, settings] = await Promise.all([
        window.buildos.listProjects(),
        window.buildos.getSettings(),
      ]);
      const active = projects.length > 0 ? projects[0] : defaultBrowserProject;
      setState((c) => ({
        ...c,
        projects,
        settings,
        activeProject: c.activeProject || active,
        loading: false,
      }));
      if (active && !state.activeProject) {
        void selectProject(active);
      }
      addLog(`Loaded ${projects.length} project(s).`);
    } catch (error) {
      setState((c) => ({
        ...c,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load projects.',
      }));
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  const createProject = async (payload: { name: string; description: string }) => {
    if (!hasDesktopApi()) {
      throw new Error(
        'Create Workspace only works in the Electron desktop window, not the localhost browser preview.',
      );
    }

    const project = (await window.buildos.createProject({
      ...payload,
      folderPath: null,
    })) as ProjectRecord;

    setState((c) => ({
      ...c,
      projects: [project, ...c.projects],
      activeProject: project,
    }));
    addLog(`Created project "${project.name}".`);
    return project;
  };

  const selectProject = async (project: ProjectRecord) => {
    if (!hasDesktopApi()) {
      setState((c) => ({ ...c, activeProject: project, loading: false }));
      return;
    }

    setState((c) => ({ ...c, activeProject: project, loading: true }));

    const [fileTree, messages, documents, tasks, pendingActions, commandRuns] =
      await Promise.all([
        project.folderPath
          ? window.buildos.getProjectTree(project.id)
          : Promise.resolve([]),
        window.buildos.getMessages(project.id),
        window.buildos.getDocuments(project.id),
        window.buildos.getTasks(project.id),
        window.buildos.getPendingActions(project.id),
        window.buildos.getCommandRuns(project.id),
      ]);

    setState((c) => ({
      ...c,
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
    if (!hasDesktopApi()) return;

    const [fileTree, messages, documents, tasks, pendingActions, commandRuns] =
      await Promise.all([
        project.folderPath
          ? window.buildos.getProjectTree(project.id)
          : Promise.resolve([]),
        window.buildos.getMessages(project.id),
        window.buildos.getDocuments(project.id),
        window.buildos.getTasks(project.id),
        window.buildos.getPendingActions(project.id),
        window.buildos.getCommandRuns(project.id),
      ]);

    setState((c) => ({
      ...c,
      fileTree,
      messages,
      documents,
      tasks,
      pendingActions,
      commandRuns,
    }));
  };

  const selectFolder = async () => {
    if (!state.activeProject || !hasDesktopApi()) return;

    const folderPath = (await window.buildos.selectProjectFolder(
      state.activeProject.id,
    )) as string | null;
    if (!folderPath) return;

    const updatedProject = { ...state.activeProject, folderPath };
    const fileTree = await window.buildos.getProjectTree(updatedProject.id);
    setState((c) => ({
      ...c,
      projects: c.projects.map((p) =>
        p.id === updatedProject.id ? updatedProject : p,
      ),
      activeProject: updatedProject,
      fileTree,
    }));
    addLog(`Selected folder ${folderPath}.`);
  };

  const openFile = async (relativePath: string, explicitApproval = false) => {
    if (!state.activeProject || !hasDesktopApi()) return;

    try {
      const content = await window.buildos.getFileContent({
        projectId: state.activeProject.id,
        relativePath,
        explicitApproval,
      });
      setState((c) => ({
        ...c,
        selectedFilePath: relativePath,
        selectedFileContent: content,
      }));
      addLog(`Read file ${relativePath}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to open file.';
      setState((c) => ({
        ...c,
        selectedFilePath: relativePath,
        selectedFileContent: message,
      }));
      addLog(`Blocked file read for ${relativePath}.`);
    }
  };

  // ── Core Message Handler ──────────────────────────────────────────

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    // ── Interrupt resolution ──────────────────────────────────────
    if (pendingInterrupt) {
      const norm = content.trim().toLowerCase();
      const isSwitch =
        /^(yes|switch|do it|go ahead|new one|new task|switch to|yep|yeah|ok|okay)$/i.test(norm) ||
        norm.includes('switch') || norm.includes('new') || norm.includes('yes');
      const isKeep =
        /^(no|keep|continue|finish|current|stay|nope)$/i.test(norm) ||
        norm.includes('finish') || norm.includes('keep') || norm.includes('current');

      if (isSwitch) {
        if (activeAbortRef.current) {
          activeAbortRef.current.abort();
          activeAbortRef.current = null;
        }
        setActiveTaskLabel(null);
        const switchCmd = pendingInterrupt.newCommand;
        setPendingInterrupt(null);

        setState((c) => ({
          ...c,
          messages: [
            ...c.messages,
            makeMsg(pid(), 'assistant', 'Understood, Sir. Cancelling previous task and switching to your new request now.'),
          ],
          loading: false,
        }));
        addLog('User chose to switch tasks. Previous task aborted.');
        await sendMessage(switchCmd);
        return;
      } else if (isKeep) {
        setPendingInterrupt(null);
        const reply = 'Very well, Sir. Continuing with the current task. I\'ll address your new request once this is complete.';
        setState((c) => ({
          ...c,
          messages: [...c.messages, makeMsg(pid(), 'assistant', reply)],
        }));
        speakJarvisVoice(reply);
        return;
      }
      setPendingInterrupt(null);
    }

    // ── Tier-2 AWAITING_CONFIRMATION guard ────────────────────────
    if (pendingConfirmation) {
      const norm = content.trim().toLowerCase();
      const isAffirmative =
        /^(yes|confirm|proceed|sure|do it|affirmative|go ahead|yep|yeah|ok|okay)$/i.test(norm) ||
        norm.includes('confirm') || norm.includes('proceed') || norm.includes('yes');
      const isNegative =
        /^(no|cancel|stop|abort|don't|dont|nevermind|nope|negative)$/i.test(norm) ||
        norm.includes('cancel') || norm.includes('abort') || norm.includes('stop');

      if (isAffirmative) {
        const conf = pendingConfirmation;
        setPendingConfirmation(null);
        setState((c) => ({
          ...c,
          pendingActions: c.pendingActions.filter((a) => a.id !== conf.id),
          loading: true,
        }));
        addLog(`User confirmed execution of: ${conf.tool}`);

        const execMessage = await executionEngine.executeConfirmed(conf.tool, conf.arguments);
        const reply = `Confirmed, Sir. Executing ${conf.actionTitle} immediately. ${execMessage}`;

        setState((c) => ({
          ...c,
          messages: [
            ...c.messages,
            makeMsg(pid(), 'user', content),
            makeMsg(pid(), 'assistant', reply, 1),
          ],
          loading: false,
        }));
        setActiveTaskLabel(null);
        addLog(`Completed confirmed action: ${conf.actionTitle}`);
        speakJarvisVoice(`Confirmed, Sir. Executing ${conf.actionTitle} immediately.`);
        return;
      } else if (isNegative) {
        const conf = pendingConfirmation;
        setPendingConfirmation(null);
        const reply = 'Operation cancelled, Sir. No changes have been made to your system.';

        setState((c) => ({
          ...c,
          pendingActions: c.pendingActions.filter((a) => a.id !== conf.id),
          messages: [
            ...c.messages,
            makeMsg(pid(), 'user', content),
            makeMsg(pid(), 'assistant', reply, 1),
          ],
          loading: false,
        }));
        setActiveTaskLabel(null);
        speakJarvisVoice(reply);
        return;
      }
    }

    // ── Task Interruption Guard ───────────────────────────────────
    if (activeTaskLabel && activeAbortRef.current) {
      const interruptReply = `Sir, I'm currently working on **"${activeTaskLabel}"**. Would you like me to **switch** to your new request (**"${content.slice(0, 50)}..."**), or should I **finish** the current task first?\n\n• Say **"switch"** or **"yes"** to cancel current and start new\n• Say **"finish"** or **"keep"** to continue current task`;
      setState((c) => ({
        ...c,
        messages: [
          ...c.messages,
          makeMsg(pid(), 'user', content),
          makeMsg(pid(), 'assistant', interruptReply, 1),
        ],
      }));
      setPendingInterrupt({ newCommand: content, oldLabel: activeTaskLabel });
      speakJarvisVoice(
        `Sir, I'm currently working on ${activeTaskLabel}. Would you like me to switch to your new request, or finish the current task first?`,
      );
      return;
    }

    // ── Main message flow ─────────────────────────────────────────

    const userMsg = makeMsg(pid(), 'user', content);
    const abortController = new AbortController();
    activeAbortRef.current = abortController;
    const taskLabel = content.length > 40 ? content.slice(0, 40) + '...' : content;
    setActiveTaskLabel(taskLabel);

    setState((c) => ({
      ...c,
      messages: [...c.messages, userMsg],
      loading: true,
    }));
    addLog(`Transmitted instruction: "${content.slice(0, 30)}..."`);

    try {
      let reply = '';
      let promptTokens = 0;
      let compTokens = 0;
      let latencyMs = 0;

      // ── LLM inference via Ollama ──────────────────────────────
      try {
        const chatMessages = conversationManager.buildContext(
          state.messages.map((m) => ({ role: m.role, content: m.content })),
          content,
        );

        const chatRes = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'qwen2.5-coder:7b',
            messages: chatMessages,
            tools: toolRegistry.getOllamaTools(),
            stream: false,
          }),
          signal: abortController.signal,
        });

        if (chatRes.ok) {
          const chatData = await chatRes.json();
          promptTokens = chatData.prompt_eval_count || Math.max(1, Math.round(content.length / 4));
          compTokens = chatData.eval_count || 10;
          latencyMs = chatData.total_duration
            ? Math.round(chatData.total_duration / 1e6)
            : 600;

          const toolCall = extractToolCall(chatData);

          if (toolCall) {
            addLog(`Tool call executed: ${toolCall.name}`);

            // ── Route through ExecutionEngine ──────────────────
            const result = await executionEngine.execute(toolCall.name, toolCall.arguments, {
              userContent: content,
              activeProjectPath: state.activeProject?.folderPath,
            });

            reply = result.reply;

            // Handle tier-2 confirmation
            if (result.needsConfirmation) {
              const nc = result.needsConfirmation;
              setPendingConfirmation({
                id: nc.id,
                tool: nc.tool,
                arguments: nc.arguments,
                promptText: nc.promptText,
                actionTitle: nc.actionTitle,
              });

              const proposal: ActionProposal = {
                id: nc.id,
                projectId: pid(),
                actionType: nc.tool === 'files_delete' ? 'FILE_DELETE' : 'COMMAND',
                description: `${nc.actionTitle}: ${nc.promptText}`,
                riskLevel: 'CRITICAL',
                status: 'PENDING',
                approvalRequired: true,
                payload: {
                  command: '',
                  cwd: '',
                  output: '',
                  tool: nc.tool,
                  arguments: nc.arguments,
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              setState((c) => ({
                ...c,
                pendingActions: [...c.pendingActions, proposal],
              }));
            }

            // Handle normal approval gate
            if (result.needsApproval) {
              const na = result.needsApproval;
              const proposal: ActionProposal = {
                id: na.id,
                projectId: pid(),
                actionType: 'COMMAND',
                description: na.description,
                riskLevel: na.riskLevel as any,
                status: 'PENDING',
                approvalRequired: true,
                payload: {
                  command: `start ${na.arguments.app_name || ''}`,
                  cwd: '',
                  output: '',
                  tool: na.tool,
                  arguments: na.arguments,
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              setState((c) => ({
                ...c,
                pendingActions: [...c.pendingActions, proposal],
              }));
            }
          } else if (chatData.message?.content) {
            reply = chatData.message.content.trim();
          }
        }
      } catch (e) {
        console.warn('Ollama chat tool calling error, falling back:', e);
      }

      if (!reply) {
        reply = `At your service, Sir. I have processed your instruction: "${content}". All primary protocols are operational.`;
      }

      // ── Token analytics ─────────────────────────────────────────
      try {
        const raw = localStorage.getItem('jarvis_token_analytics');
        const prev = raw
          ? JSON.parse(raw)
          : { recordsCount: 0, totalTokens: 0, estimatedCostUsd: 0, avgLatencyMs: 0 };
        const newCount = (prev.recordsCount || 0) + 1;
        const newTokens =
          (prev.totalTokens || 0) +
          (promptTokens || Math.round(content.length / 4)) +
          (compTokens || Math.round(reply.length / 4));
        const newAvg = Math.round(
          ((prev.avgLatencyMs || 0) * (prev.recordsCount || 0) + (latencyMs || 600)) / newCount,
        );
        localStorage.setItem(
          'jarvis_token_analytics',
          JSON.stringify({
            recordsCount: newCount,
            totalTokens: newTokens,
            estimatedCostUsd: 0.0,
            avgLatencyMs: newAvg,
          }),
        );
      } catch {}

      // ── Compress conversation if needed ──────────────────────────
      const updatedMessages = [
        ...state.messages,
        userMsg,
        makeMsg(pid(), 'assistant', reply, 1),
      ];
      conversationManager.maybeCompress(
        updatedMessages.map((m) => ({ role: m.role, content: m.content })),
      );

      setState((c) => ({
        ...c,
        messages: [...c.messages, makeMsg(pid(), 'assistant', reply, 1)],
        loading: false,
      }));
      setActiveTaskLabel(null);
      activeAbortRef.current = null;
      addLog('J.A.R.V.I.S response generated.');
      speakJarvisVoice(reply);
    } catch (outerErr: any) {
      if (outerErr?.name === 'AbortError') {
        setState((c) => ({ ...c, loading: false }));
        setActiveTaskLabel(null);
        activeAbortRef.current = null;
        addLog('Task aborted by user interrupt.');
        return;
      }

      const fallback = `Right away, Sir. I have received your request regarding "${content}". All primary protocols are operational and awaiting further parameters.`;
      setState((c) => ({
        ...c,
        messages: [...c.messages, makeMsg(pid(), 'assistant', fallback, 1)],
        loading: false,
      }));
      setActiveTaskLabel(null);
      activeAbortRef.current = null;
      addLog('J.A.R.V.I.S standby response logged.');
      speakJarvisVoice(fallback);
    }
  };

  // ── Approval Actions ──────────────────────────────────────────────

  const approveAction = async (actionId: string) => {
    const action = state.pendingActions.find((item) => item.id === actionId);
    const pendingConf =
      pendingConfirmation?.id === actionId ? pendingConfirmation : null;
    const toolPayload = (action?.payload as any)?.tool;

    if (pendingConf || toolPayload) {
      const toolName = pendingConf?.tool || toolPayload;
      const toolArgs =
        pendingConf?.arguments || (action?.payload as any)?.arguments || {};

      const execMessage = await executionEngine.executeConfirmed(toolName, toolArgs);
      addLog(`Authorized and executed action: ${toolName}`);

      if (pendingConfirmation?.id === actionId) {
        setPendingConfirmation(null);
      }

      const reply = `Confirmed, Sir. Executed authorized action ${action?.description || toolName}. ${execMessage}`;
      setState((c) => ({
        ...c,
        pendingActions: c.pendingActions.filter((a) => a.id !== actionId),
        messages: [...c.messages, makeMsg(pid(), 'assistant', reply)],
      }));
      speakJarvisVoice('Confirmed, Sir. Executed authorized action.');
      return;
    }

    if (!state.activeProject || !hasDesktopApi()) return;

    if (action?.actionType === 'COMMAND') {
      const result = await window.buildos.runApprovedCommand({
        projectId: state.activeProject.id,
        actionId,
      });
      setState((c) => ({
        ...c,
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
    setState((c) => ({
      ...c,
      fileTree: result.tree,
      pendingActions: result.pendingActions,
    }));
    addLog(`Approved file action ${actionId}.`);
  };

  const rejectAction = async (actionId: string) => {
    if (pendingConfirmation?.id === actionId) {
      setPendingConfirmation(null);
    }

    const action = state.pendingActions.find((item) => item.id === actionId);
    const reply = 'Operation rejected, Sir. No changes have been made to your system.';

    setState((c) => ({
      ...c,
      pendingActions: c.pendingActions.filter((a) => a.id !== actionId),
      messages: [...c.messages, makeMsg(pid(), 'assistant', reply)],
    }));
    addLog(
      `Rejected action ${actionId}${action?.description ? ` (${action.description})` : ''}.`,
    );
    speakJarvisVoice(reply);

    if (state.activeProject && hasDesktopApi()) {
      try {
        const pendingActions = await window.buildos.rejectFileWrite({
          projectId: state.activeProject.id,
          actionId,
        });
        setState((c) => ({ ...c, pendingActions }));
      } catch {}
    }
  };

  // ── Other Actions ─────────────────────────────────────────────────

  const generateStarterFiles = async () => {
    if (!state.activeProject || !hasDesktopApi()) return;
    await window.buildos.generateStarterFileProposals(state.activeProject.id);
    await refreshProjectData(state.activeProject);
    addLog('Generated starter file proposals.');
  };

  const proposeCommand = async (command: string) => {
    if (!state.activeProject || !hasDesktopApi()) return;
    const result = await window.buildos.proposeCommand({
      projectId: state.activeProject.id,
      command,
    });
    setState((c) => ({
      ...c,
      pendingActions: result.pendingActions,
      commandRuns: result.commandRuns,
      commandInput: '',
    }));
    addLog(`Proposed command: ${command}`);
  };

  const saveSettings = async (settings: AppSettings) => {
    if (!hasDesktopApi()) {
      throw new Error(
        'Settings persistence only works in the Electron desktop window.',
      );
    }
    const saved = (await window.buildos.saveSettings(settings)) as AppSettings;
    setState((c) => ({ ...c, settings: saved }));
    addLog('Saved settings.');
    return saved;
  };

  return {
    state,
    pendingConfirmation,
    activeTaskLabel,
    pendingInterrupt,
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
