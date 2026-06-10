import { dialog, ipcMain, shell } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { OrchestratorAgent } from '../../../packages/agents/orchestrator.agent';
import { RequirementAgent } from '../../../packages/agents/requirements.agent';
import { PRDAgent } from '../../../packages/agents/prd.agent';
import { CTOAgent } from '../../../packages/agents/cto.agent';
import { ArchitectAgent } from '../../../packages/agents/architect.agent';
import { ProjectManagerAgent } from '../../../packages/agents/project-manager.agent';
import { createProvider } from '../../../packages/ai/model-router';
import type { AIProvider } from '../../../packages/ai/providers/ai-provider.interface';
import type Database from 'better-sqlite3';
import { ApprovalService } from './services/approval.service';
import { CommandRunnerService } from './services/command-runner.service';
import { FileSystemService } from './services/file-system.service';
import { ProjectService } from './services/project.service';
import { SecurityService } from './services/security.service';
import { SettingsService } from './services/settings.service';
import { StarterFilesService } from './services/starter-files.service';
import type { AgentOutput } from '../../../packages/shared/types';

interface IpcDependencies {
  db: Database;
  appDataPath: string;
  provider: AIProvider | null;
}

const buildRoadmapMarkdown = (tasksMarkdownSource: Array<{ title: string; team: string; priority: string; dependenciesJson: string }>): string =>
  `# Roadmap

## Milestone 1: Planning Foundation
- Finalize scope, requirements, and safety model
- Lock technical direction and architecture

## Milestone 2: Workspace Core
- Implement folder selection, safe file access, chat, docs, and tasks
- Add persistent settings and project memory

## Milestone 3: Approval Workflows
- Add approval queue for file writes and commands
- Persist command outputs and action history

## Team Sequencing
${tasksMarkdownSource
  .map((task) => `- ${task.team}: ${task.title} (${task.priority}) deps ${task.dependenciesJson}`)
  .join('\n')}`;

const buildApiPlanMarkdown = (): string => `# API and IPC Plan

## Project APIs
- listProjects
- createProject
- selectProjectFolder

## File APIs
- getProjectTree
- getFileContent
- proposeFileWrite
- approveFileWrite
- rejectFileWrite

## Chat APIs
- sendChatMessage
- getMessages
- getDocuments
- getTasks

## Command APIs
- classifyCommand
- proposeCommand
- runApprovedCommand

## Settings APIs
- getSettings
- saveSettings`;

const buildDatabaseSchemaMarkdown = (): string => `# Database Schema

## Core Tables
- projects
- messages
- requirements
- documents
- tasks
- agent_runs
- actions
- file_changes
- command_runs
- app_settings

## Notes
- Projects scope all workspace memory
- Actions are the approval lifecycle anchor
- File changes and command runs attach executable payloads to actions
- Settings stay local to the desktop app`;

export const registerIpcHandlers = ({ db, appDataPath, provider }: IpcDependencies): void => {
  const securityService = new SecurityService();
  const fileSystemService = new FileSystemService(securityService);
  const projectService = new ProjectService(db, fileSystemService);
  const approvalService = new ApprovalService(db);
  const commandRunnerService = new CommandRunnerService(db, securityService);
  const starterFilesService = new StarterFilesService();
  const settingsService = new SettingsService(db);

  projectService.runMigrations(path.join(appDataPath, 'electron', 'db', 'migrations'));

  const resolveProvider = (): AIProvider | null => {
    try {
      const settings = settingsService.getSettings();
      return createProvider({
        geminiApiKey: settings.geminiApiKey || process.env.GEMINI_API_KEY,
        groqApiKey: settings.groqApiKey || process.env.GROQ_API_KEY,
        ollamaBaseUrl: settings.ollamaBaseUrl || process.env.OLLAMA_BASE_URL,
        providerMode: settings.providerMode,
        selectedProvider: settings.selectedProvider,
        selectedModel: settings.selectedModel,
      });
    } catch {
      return provider;
    }
  };

  ipcMain.handle('projects:list', () => projectService.listProjects());
  ipcMain.handle('projects:create', (_, payload: { name: string; description: string; folderPath: string | null }) =>
    projectService.createProject(payload.name, payload.description, payload.folderPath),
  );
  ipcMain.handle('projects:select-folder', async (_, projectId: string) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Project Folder',
    });

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    const folderPath = result.filePaths[0];
    projectService.updateProjectFolder(projectId, folderPath);
    return folderPath;
  });

  ipcMain.handle('projects:tree', (_, projectId: string) => projectService.getProjectTree(projectId));
  ipcMain.handle('projects:file-content', (_, payload: { projectId: string; relativePath: string; explicitApproval?: boolean }) =>
    projectService.readProjectFile(payload.projectId, payload.relativePath, payload.explicitApproval ?? false),
  );
  ipcMain.handle('projects:messages', (_, projectId: string) => projectService.listMessages(projectId));
  ipcMain.handle('projects:documents', (_, projectId: string) => projectService.listDocuments(projectId));
  ipcMain.handle('projects:tasks', (_, projectId: string) => projectService.listTasks(projectId));
  ipcMain.handle('projects:pending-actions', (_, projectId: string) => approvalService.listPendingActions(projectId));
  ipcMain.handle('projects:command-runs', (_, projectId: string) => projectService.listCommandRuns(projectId));
  ipcMain.handle('settings:get', () => settingsService.getSettings());
  ipcMain.handle('settings:save', (_, settings) => settingsService.saveSettings(settings));

  ipcMain.handle('workspace:open-vscode', async (_, folderPath: string) => {
    try {
      const child = spawn('cmd.exe', ['/c', 'code', folderPath], {
        cwd: folderPath,
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      child.unref();
      return 'ok';
    } catch {
      return shell.openPath(folderPath);
    }
  });
  ipcMain.handle('workspace:open-terminal', async (_, folderPath: string) => {
    const escapedFolderPath = folderPath.replace(/'/g, "''");
    const child = spawn(
      'cmd.exe',
      ['/c', 'start', 'powershell', '-NoExit', '-Command', `Set-Location -LiteralPath '${escapedFolderPath}'`],
      {
        cwd: folderPath,
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      },
    );
    child.unref();
    return 'ok';
  });
  ipcMain.handle('workspace:open-browser-url', (_, url: string) => shell.openExternal(url));

  ipcMain.handle('chat:send', async (_, payload: { projectId: string; content: string }) => {
    const project = projectService.getProject(payload.projectId);
    if (!project) {
      throw new Error('Project not found.');
    }

    const existingMessages = projectService.listMessages(project.id);
    projectService.saveMessage({
      projectId: project.id,
      role: 'user',
      agentName: 'System',
      content: payload.content,
    });

    const activeProvider = resolveProvider();
    const orchestrator = new OrchestratorAgent(activeProvider);
    const decision = await orchestrator.run({
      message: payload.content,
      projectHasRequirements: existingMessages.length > 0,
    });

    const outputs: AgentOutput[] = [decision];

    if (decision.data.commandType === 'NEW_PROJECT_BUILD') {
      const requirementAgent = new RequirementAgent(activeProvider);
      outputs.push(await requirementAgent.run({ command: payload.content }));
    } else if (decision.data.commandType === 'RUN_COMMAND') {
      if (!project.folderPath) {
        throw new Error('Project folder not selected.');
      }

      approvalService.createCommandProposal(
        project.id,
        `Run command in selected folder: ${payload.content}`,
        securityService.classifyCommandRisk(payload.content),
        {
          command: payload.content,
          cwd: project.folderPath,
          output: '',
        },
      );

      projectService.saveMessage({
        projectId: project.id,
        role: 'assistant',
        agentName: 'Security Agent',
        content: `Command proposal created for approval: ${payload.content}`,
      });
    } else if (decision.data.commandType === 'REQUIREMENTS_ANSWER') {
      const requirementSummary = payload.content;
      const prdAgent = new PRDAgent(activeProvider);
      const ctoAgent = new CTOAgent(activeProvider);
      const architectAgent = new ArchitectAgent(activeProvider);
      const pmAgent = new ProjectManagerAgent(activeProvider);

      const prd = await prdAgent.run({ projectName: project.name, requirementsSummary: requirementSummary });
      const techStack = await ctoAgent.run({ projectName: project.name });
      const architecture = await architectAgent.run({ projectName: project.name });
      const tasks = await pmAgent.run({ projectId: project.id });

      outputs.push(prd, techStack, architecture, tasks);

      projectService.saveDocument({
        projectId: project.id,
        type: 'PRD',
        title: 'Product Requirements Document',
        content: prd.data,
        version: 1,
      });
      projectService.saveDocument({
        projectId: project.id,
        type: 'TECH_STACK',
        title: 'Tech Stack Recommendation',
        content: techStack.data,
        version: 1,
      });
      projectService.saveDocument({
        projectId: project.id,
        type: 'ARCHITECTURE',
        title: 'System Architecture',
        content: architecture.data,
        version: 1,
      });
      projectService.saveDocument({
        projectId: project.id,
        type: 'API_PLAN',
        title: 'API Plan',
        content: buildApiPlanMarkdown(),
        version: 1,
      });
      projectService.saveDocument({
        projectId: project.id,
        type: 'DATABASE_SCHEMA',
        title: 'Database Schema',
        content: buildDatabaseSchemaMarkdown(),
        version: 1,
      });
      const savedTasks = projectService.replaceTasks(project.id, tasks.data);
      projectService.saveDocument({
        projectId: project.id,
        type: 'ROADMAP',
        title: 'Roadmap',
        content: buildRoadmapMarkdown(savedTasks),
        version: 1,
      });
    }

    outputs.forEach((output) => {
      projectService.saveMessage({
        projectId: project.id,
        role: 'assistant',
        agentName: output.agentName,
        content: typeof output.data === 'string' ? output.data : JSON.stringify(output.data, null, 2),
      });
    });

    return {
      messages: projectService.listMessages(project.id),
      documents: projectService.listDocuments(project.id),
      tasks: projectService.listTasks(project.id),
      pendingActions: approvalService.listPendingActions(project.id),
      commandRuns: projectService.listCommandRuns(project.id),
    };
  });

  ipcMain.handle(
    'files:propose-write',
    (_, payload: { projectId: string; relativePath: string; content: string; description: string }) => {
      const project = projectService.getProject(payload.projectId);
      if (!project?.folderPath) {
        throw new Error('Project folder not selected.');
      }

      const diff = fileSystemService.proposeWrite(project.folderPath, payload.relativePath, payload.content);
      return approvalService.createFileWriteProposal(project.id, payload.description, 'MEDIUM', {
        filePath: payload.relativePath,
        beforeContent: diff.beforeContent,
        afterContent: diff.afterContent,
        changeType: diff.beforeContent ? 'UPDATE' : 'CREATE',
      });
    },
  );
  ipcMain.handle('files:generate-starter-proposals', (_, projectId: string) => {
    const project = projectService.getProject(projectId);
    if (!project?.folderPath) {
      throw new Error('Project folder not selected.');
    }

    const documents = projectService.listDocuments(projectId);
    const tasks = projectService.listTasks(projectId);
    const starterFiles = starterFilesService.createStarterFiles(project, documents, tasks);

    const proposals = starterFiles.map((file) => {
      const diff = fileSystemService.proposeWrite(project.folderPath!, file.relativePath, file.content);
      return approvalService.createFileWriteProposal(project.id, file.description, 'MEDIUM', {
        filePath: file.relativePath,
        beforeContent: diff.beforeContent,
        afterContent: diff.afterContent,
        changeType: diff.beforeContent ? 'UPDATE' : 'CREATE',
      });
    });

    return proposals;
  });
  ipcMain.handle('files:approve-write', (_, payload: { projectId: string; actionId: string }) => {
    const project = projectService.getProject(payload.projectId);
    if (!project?.folderPath) {
      throw new Error('Project folder not selected.');
    }

    const fileChange = approvalService.getFileChangeByActionId(payload.actionId);
    if (!fileChange) {
      throw new Error('File change proposal not found.');
    }

    fileSystemService.writeFile(project.folderPath, fileChange.filePath, fileChange.afterContent);
    approvalService.updateActionStatus(payload.actionId, 'COMPLETED');

    return {
      tree: projectService.getProjectTree(project.id),
      pendingActions: approvalService.listPendingActions(project.id),
    };
  });
  ipcMain.handle('files:reject-write', (_, payload: { projectId: string; actionId: string }) => {
    approvalService.updateActionStatus(payload.actionId, 'REJECTED');
    return approvalService.listPendingActions(payload.projectId);
  });

  ipcMain.handle('commands:propose', (_, payload: { projectId: string; command: string }) => {
    const project = projectService.getProject(payload.projectId);
    if (!project?.folderPath) {
      throw new Error('Project folder not selected.');
    }

    const settings = settingsService.getSettings();
    const riskLevel = securityService.classifyCommandRisk(payload.command);
    if (!settings.requireCommandApproval && securityService.isCommandAllowed(payload.command)) {
      throw new Error('Direct execution without approval is not enabled in V1.');
    }

    if (!securityService.isCommandAllowed(payload.command)) {
      throw new Error('Blocked dangerous command.');
    }

    const proposal = approvalService.createCommandProposal(
      project.id,
      `Run command in selected folder: ${payload.command}`,
      riskLevel,
      {
        command: payload.command,
        cwd: project.folderPath,
        output: '',
      },
    );

    return {
      proposal,
      pendingActions: approvalService.listPendingActions(project.id),
      commandRuns: projectService.listCommandRuns(project.id),
    };
  });

  ipcMain.handle('commands:classify', (_, command: string) => ({
    riskLevel: securityService.classifyCommandRisk(command),
    allowed: securityService.isCommandAllowed(command),
  }));

  ipcMain.handle('commands:run-approved', async (_, payload: { projectId: string; actionId: string }) => {
    const result = await commandRunnerService.runApprovedCommand(payload.actionId);
    approvalService.updateActionStatus(payload.actionId, result.approvalStatus === 'FAILED' ? 'FAILED' : 'COMPLETED');
    return {
      commandRun: result,
      pendingActions: approvalService.listPendingActions(payload.projectId),
      commandRuns: projectService.listCommandRuns(payload.projectId),
    };
  });
};
