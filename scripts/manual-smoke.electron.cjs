const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const rootDir = __dirname ? path.resolve(__dirname, '..') : process.cwd();
const migrationsDir = path.join(rootDir, 'apps', 'desktop', 'electron', 'db', 'migrations');
const compiledBase = path.join(rootDir, 'apps', 'desktop', 'dist-electron');

const { SecurityService } = require(path.join(compiledBase, 'apps', 'desktop', 'electron', 'services', 'security.service.js'));
const { FileSystemService } = require(path.join(compiledBase, 'apps', 'desktop', 'electron', 'services', 'file-system.service.js'));
const { ProjectService } = require(path.join(compiledBase, 'apps', 'desktop', 'electron', 'services', 'project.service.js'));
const { ApprovalService } = require(path.join(compiledBase, 'apps', 'desktop', 'electron', 'services', 'approval.service.js'));
const { StarterFilesService } = require(path.join(compiledBase, 'apps', 'desktop', 'electron', 'services', 'starter-files.service.js'));
const { CommandRunnerService } = require(path.join(compiledBase, 'apps', 'desktop', 'electron', 'services', 'command-runner.service.js'));
const { SettingsService } = require(path.join(compiledBase, 'apps', 'desktop', 'electron', 'services', 'settings.service.js'));
const { OrchestratorAgent } = require(path.join(compiledBase, 'packages', 'agents', 'orchestrator.agent.js'));
const { RequirementAgent } = require(path.join(compiledBase, 'packages', 'agents', 'requirements.agent.js'));
const { PRDAgent } = require(path.join(compiledBase, 'packages', 'agents', 'prd.agent.js'));
const { CTOAgent } = require(path.join(compiledBase, 'packages', 'agents', 'cto.agent.js'));
const { ArchitectAgent } = require(path.join(compiledBase, 'packages', 'agents', 'architect.agent.js'));
const { ProjectManagerAgent } = require(path.join(compiledBase, 'packages', 'agents', 'project-manager.agent.js'));

const smokeRoot = path.join(rootDir, 'demo-workspace', 'smoke-email-assistant');
const dbPath = path.join(rootDir, 'demo-workspace', 'smoke-test.sqlite');

const run = async () => {
  fs.mkdirSync(smokeRoot, { recursive: true });
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  const db = new Database(dbPath);
  try {
    const securityService = new SecurityService();
    const fileSystemService = new FileSystemService(securityService);
    const projectService = new ProjectService(db, fileSystemService);
    const approvalService = new ApprovalService(db);
    const starterFilesService = new StarterFilesService();
    const commandRunnerService = new CommandRunnerService(db, securityService);
    const settingsService = new SettingsService(db);

    projectService.runMigrations(migrationsDir);

    const project = projectService.createProject(
      'Smoke Email Assistant',
      'Manual smoke test for BuildOS AI',
      smokeRoot,
    );

    const buildPrompt =
      "Let's build an AI email assistant that checks my important emails, drafts replies, and asks me before sending.";
    const requirementsAnswer =
      'Primary goal: save time replying to important emails. Use Gmail first. Important means VIP senders, urgent language, invoices, and job-related emails. Draft only in V1, never auto-send. Manual scan first, scheduled scan later. Single-user MVP. Store approval and draft history locally for 30 days. Use Gemini in cloud mode first, but keep Ollama support later. Safety rules: approval required for every draft, blocked recipients list, and audit logs. Timeline constraint: keep MVP small and demo-focused.';

    const orchestrator = new OrchestratorAgent(null);
    const requirementAgent = new RequirementAgent(null);
    const prdAgent = new PRDAgent(null);
    const ctoAgent = new CTOAgent(null);
    const architectAgent = new ArchitectAgent(null);
    const pmAgent = new ProjectManagerAgent(null);

    const decision1 = await orchestrator.run({
      message: buildPrompt,
      projectHasRequirements: false,
    });
    const requirementQuestions = await requirementAgent.run({ command: buildPrompt });
    const decision2 = await orchestrator.run({
      message: requirementsAnswer,
      projectHasRequirements: true,
    });
    const prd = await prdAgent.run({
      projectName: project.name,
      requirementsSummary: requirementsAnswer,
    });
    const tech = await ctoAgent.run({ projectName: project.name });
    const architecture = await architectAgent.run({ projectName: project.name });
    const tasks = await pmAgent.run({ projectId: project.id });

    projectService.saveMessage({
      projectId: project.id,
      role: 'user',
      agentName: 'System',
      content: buildPrompt,
    });
    projectService.saveMessage({
      projectId: project.id,
      role: 'assistant',
      agentName: decision1.agentName,
      content: JSON.stringify(decision1.data, null, 2),
    });
    projectService.saveMessage({
      projectId: project.id,
      role: 'assistant',
      agentName: requirementQuestions.agentName,
      content: JSON.stringify(requirementQuestions.data, null, 2),
    });
    projectService.saveMessage({
      projectId: project.id,
      role: 'user',
      agentName: 'System',
      content: requirementsAnswer,
    });
    projectService.saveMessage({
      projectId: project.id,
      role: 'assistant',
      agentName: decision2.agentName,
      content: JSON.stringify(decision2.data, null, 2),
    });

    for (const doc of [
      { type: 'PRD', title: 'Product Requirements Document', content: prd.data },
      { type: 'TECH_STACK', title: 'Tech Stack Recommendation', content: tech.data },
      { type: 'ARCHITECTURE', title: 'System Architecture', content: architecture.data },
      { type: 'API_PLAN', title: 'API Plan', content: '# API Plan\n\n- listProjects\n- sendChatMessage\n- proposeCommand' },
      { type: 'DATABASE_SCHEMA', title: 'Database Schema', content: '# Database Schema\n\n- projects\n- documents\n- tasks\n- actions\n- command_runs' },
      { type: 'ROADMAP', title: 'Roadmap', content: '# Roadmap\n\n- Planning Foundation\n- Workspace Core\n- Approval Workflows' },
    ]) {
      projectService.saveDocument({
        projectId: project.id,
        type: doc.type,
        title: doc.title,
        content: doc.content,
        version: 1,
      });
    }

    const savedTasks = projectService.replaceTasks(project.id, tasks.data);

    const starterFiles = starterFilesService.createStarterFiles(project, projectService.listDocuments(project.id), savedTasks);
    const proposals = starterFiles.map((file) => {
      const diff = fileSystemService.proposeWrite(project.folderPath, file.relativePath, file.content);
      return approvalService.createFileWriteProposal(project.id, file.description, 'MEDIUM', {
        filePath: file.relativePath,
        beforeContent: diff.beforeContent,
        afterContent: diff.afterContent,
        changeType: diff.beforeContent ? 'UPDATE' : 'CREATE',
      });
    });

    for (const proposal of proposals) {
      const fileChange = approvalService.getFileChangeByActionId(proposal.id);
      fileSystemService.writeFile(project.folderPath, fileChange.filePath, fileChange.afterContent);
      approvalService.updateActionStatus(proposal.id, 'COMPLETED');
    }

    const protectedFilePath = path.join(project.folderPath, '.env');
    fs.writeFileSync(protectedFilePath, 'SECRET=1', 'utf-8');
    let protectedReadBlocked = false;
    try {
      fileSystemService.readFile(project.folderPath, '.env', false);
    } catch (_error) {
      protectedReadBlocked = true;
    }
    const protectedReadWithApproval = fileSystemService.readFile(project.folderPath, '.env', true);

    const savedSettings = settingsService.saveSettings({
      geminiApiKey: 'demo-gemini-key',
      groqApiKey: '',
      ollamaBaseUrl: 'http://localhost:11434',
      selectedProvider: 'gemini',
      providerMode: 'cloud',
      selectedModel: 'gemini-1.5-pro',
      requireCommandApproval: true,
      requireFileApproval: true,
      protectSensitiveFiles: true,
      allowProtectedReadsWithApproval: true,
    });

    const commandProposal = approvalService.createCommandProposal(
      project.id,
      'Run smoke command in selected folder',
      'LOW',
      {
        command: `node -e "console.log('smoke-ok')"`,
        cwd: project.folderPath,
        output: '',
      },
    );
    const commandRun = await commandRunnerService.runApprovedCommand(commandProposal.id);
    approvalService.updateActionStatus(commandProposal.id, commandRun.approvalStatus === 'FAILED' ? 'FAILED' : 'COMPLETED');

    const result = {
      project: {
        id: project.id,
        folderPath: project.folderPath,
      },
      firstDecision: decision1.data,
      secondDecision: decision2.data,
      requirementQuestionCount: requirementQuestions.data.length,
      documentCount: projectService.listDocuments(project.id).length,
      documentTitles: projectService.listDocuments(project.id).map((doc) => doc.title),
      taskCount: projectService.listTasks(project.id).length,
      starterFileProposalCount: proposals.length,
      wroteFiles: starterFiles.map((file) => file.relativePath),
      wroteFilesExist: starterFiles.every((file) => fs.existsSync(path.join(project.folderPath, file.relativePath))),
      fileTreeTopLevel: projectService.getProjectTree(project.id).map((node) => node.name),
      protectedReadBlocked,
      protectedReadWithApproval,
      savedSettings,
      commandOutput: commandRun.output,
      pendingActionsAfterExecution: approvalService.listPendingActions(project.id).length,
    };

    console.log(JSON.stringify(result, null, 2));
  } finally {
    db.close();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
