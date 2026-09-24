import type { CommandType, RiskLevel } from './types';

export interface GenerateStructuredSchema {
  name: string;
  description: string;
  shape: Record<string, string>;
}

export const orchestratorDecisionSchema: GenerateStructuredSchema = {
  name: 'OrchestratorDecision',
  description: 'Classifies a chat command and routes it to the next BuildOS AI agent.',
  shape: {
    commandType: 'CommandType',
    nextAgent: 'AgentName',
    requiredInputs: 'string[]',
    approvalNeeded: 'boolean',
    explanation: 'string',
  },
};

export const requirementQuestionSchema: GenerateStructuredSchema = {
  name: 'RequirementQuestion',
  description: 'A single requirements clarification question with a rationale.',
  shape: {
    id: 'string',
    question: 'string',
    rationale: 'string',
  },
};

export const taskSchema: GenerateStructuredSchema = {
  name: 'TaskRecord',
  description: 'A single team task item for the BuildOS AI task board.',
  shape: {
    title: 'string',
    description: 'string',
    team: 'Product|Frontend|Backend|AI|Database|QA|DevOps|Security',
    priority: 'P0|P1|P2|P3',
    status: 'TODO|IN_PROGRESS|BLOCKED|DONE',
    dependencies: 'string[]',
  },
};

export const workflowPlanSchema: GenerateStructuredSchema = {
  name: 'WorkflowPlan',
  description: 'Decomposes a multi-step user goal into an ordered sequence of executable tool steps.',
  shape: {
    goal: 'string',
    steps: 'Array<{ id: string; tool: string; description: string; arguments: Record<string, unknown>; outputKey?: string }>',
    estimatedDurationSeconds: 'number',
    requiresApproval: 'boolean',
    explanation: 'string',
  },
};

export const isCommandType = (value: string): value is CommandType =>
  [
    'NEW_PROJECT_BUILD',
    'REQUIREMENTS_ANSWER',
    'CODEBASE_REVIEW',
    'GENERATE_PRD',
    'GENERATE_ARCHITECTURE',
    'GENERATE_TASKS',
    'PROPOSE_FILES',
    'EDIT_FILE',
    'RUN_COMMAND',
    'TOOL_EXECUTION',
    'WORKFLOW_EXECUTION',
    'GENERAL_QUESTION',
  ].includes(value);

export const isRiskLevel = (value: string): value is RiskLevel =>
  ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(value);


