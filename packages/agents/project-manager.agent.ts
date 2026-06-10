import type { AIProvider } from '../ai/providers/ai-provider.interface';
import type { AgentOutput, TaskRecord } from '../shared/types';
import { BaseAgent } from './base';

interface ProjectManagerInput {
  projectId: string;
}

const defaultTasks: Omit<TaskRecord, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: 'Define MVP scope and non-goals',
    description: 'Lock the product narrative, target user, MVP feature list, non-goals, and demo acceptance criteria.',
    team: 'Product',
    priority: 'P0',
    status: 'TODO',
    dependenciesJson: '[]',
  },
  {
    title: 'Design workspace screens and navigation',
    description: 'Finalize the home flow, workspace layout, settings screen, command center, and approval interactions.',
    team: 'Frontend',
    priority: 'P0',
    status: 'TODO',
    dependenciesJson: '["Define MVP scope and non-goals"]',
  },
  {
    title: 'Build approval-gated action pipeline',
    description: 'Store proposed file writes and command runs, support approval or rejection, and surface results back to the UI.',
    team: 'Backend',
    priority: 'P0',
    status: 'TODO',
    dependenciesJson: '["Define MVP scope and non-goals"]',
  },
  {
    title: 'Define prompt routing and provider configuration',
    description: 'Support Gemini, Groq, and Ollama through one abstraction with settings-backed model selection.',
    team: 'AI',
    priority: 'P1',
    status: 'TODO',
    dependenciesJson: '["Build approval-gated action pipeline"]',
  },
  {
    title: 'Model project memory schema',
    description: 'Persist projects, messages, documents, tasks, actions, file changes, command runs, and settings cleanly in SQLite.',
    team: 'Database',
    priority: 'P1',
    status: 'TODO',
    dependenciesJson: '["Build approval-gated action pipeline"]',
  },
  {
    title: 'Add workflow tests for approval and path safety',
    description: 'Cover boundary checks, protected-file rules, command classification, and settings CRUD with automated tests.',
    team: 'QA',
    priority: 'P1',
    status: 'TODO',
    dependenciesJson: '["Model project memory schema"]',
  },
  {
    title: 'Prepare local run scripts and packaging baseline',
    description: 'Make sure the desktop app can install, build, and run reliably in a developer environment.',
    team: 'DevOps',
    priority: 'P2',
    status: 'TODO',
    dependenciesJson: '["Build approval-gated action pipeline"]',
  },
  {
    title: 'Review unsafe paths and command policy',
    description: 'Validate that risky commands, secret files, and out-of-bounds paths are blocked or approval-gated.',
    team: 'Security',
    priority: 'P0',
    status: 'TODO',
    dependenciesJson: '["Build approval-gated action pipeline"]',
  },
];

export class ProjectManagerAgent extends BaseAgent<ProjectManagerInput, typeof defaultTasks> {
  constructor(provider: AIProvider | null) {
    super(provider, 'Project Manager Agent');
  }

  async run(_: ProjectManagerInput): Promise<AgentOutput<typeof defaultTasks>> {
    return {
      agentName: 'Project Manager Agent',
      summary: 'Prepared the initial cross-functional task board.',
      data: defaultTasks,
    };
  }
}
