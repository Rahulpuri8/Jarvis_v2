export type CommandType =
  | 'NEW_PROJECT_BUILD'
  | 'REQUIREMENTS_ANSWER'
  | 'CODEBASE_REVIEW'
  | 'GENERATE_PRD'
  | 'GENERATE_ARCHITECTURE'
  | 'GENERATE_TASKS'
  | 'PROPOSE_FILES'
  | 'EDIT_FILE'
  | 'RUN_COMMAND'
  | 'TOOL_EXECUTION'
  | 'WORKFLOW_EXECUTION'
  | 'GENERAL_QUESTION';

export type AgentName =
  | 'Orchestrator Agent'
  | 'Requirement Agent'
  | 'PRD Agent'
  | 'CTO Agent'
  | 'Architect Agent'
  | 'Project Manager Agent'
  | 'Frontend Agent'
  | 'Backend Agent'
  | 'AI Agent'
  | 'QA Agent'
  | 'DevOps Agent'
  | 'Security Agent'
  | 'Tool Runtime Agent'
  | 'Workflow Planner Agent';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'FAILED';

export interface WorkflowStep {
  id: string;
  tool: string;
  description: string;
  arguments: Record<string, unknown>;
  dependsOn?: string[];
  outputKey?: string;
}

export interface WorkflowPlan {
  goal: string;
  steps: WorkflowStep[];
  estimatedDurationSeconds?: number;
  requiresApproval?: boolean;
  explanation: string;
}

export interface WorkflowStepResult {
  stepId: string;
  tool: string;
  description: string;
  status: 'completed' | 'failed' | 'skipped';
  durationMs: number;
  result?: ToolResult;
  error?: string;
}

export interface WorkflowExecutionResult {
  plan: WorkflowPlan;
  status: 'completed' | 'partial' | 'failed';
  stepResults: WorkflowStepResult[];
  context: Record<string, unknown>;
  summary: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  arguments_schema: Record<string, unknown>;
  risk_level: number;
  permissions: string[];
  timeout: number;
  supports_undo: boolean;
  side_effects: boolean;
}

export interface ToolRequest {
  tool: string;
  arguments?: Record<string, unknown>;
  request_id?: string;
  bypass_risk_check?: boolean;
}

export interface ToolResult<T = Record<string, unknown>> {
  success: boolean;
  status: 'completed' | 'failed' | 'rejected' | 'pending_approval';
  data?: T;
  message: string;
  error?: string | null;
  retryable?: boolean;
  request_id: string;
  duration_ms?: number;
  timestamp?: number;
}

export interface RuntimeStatus {
  online: boolean;
  status: string;
  total_tools: number;
  categories: string[];
  uptime_seconds?: number;
  error?: string;
}


export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  folderPath: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  projectId: string;
  role: 'user' | 'assistant' | 'system';
  agentName: AgentName | 'System';
  content: string;
  createdAt: string;
}

export interface RequirementRecord {
  id: string;
  projectId: string;
  question: string;
  answer: string;
  status: 'PENDING' | 'ANSWERED';
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  projectId: string;
  type: 'PRD' | 'ARCHITECTURE' | 'TECH_STACK' | 'DATABASE_SCHEMA' | 'API_PLAN' | 'ROADMAP' | 'TASKS';
  title: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  projectId: string;
  title: string;
  description: string;
  team: 'Product' | 'Frontend' | 'Backend' | 'AI' | 'Database' | 'QA' | 'DevOps' | 'Security';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
  dependenciesJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionRecord {
  id: string;
  projectId: string;
  actionType: 'FILE_CREATE' | 'FILE_EDIT' | 'FILE_DELETE' | 'COMMAND' | 'EXTERNAL_API';
  description: string;
  riskLevel: RiskLevel;
  status: ApprovalStatus;
  approvalRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FileChangeRecord {
  id: string;
  actionId?: string;
  projectId: string;
  filePath: string;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE';
  beforeContent: string;
  afterContent: string;
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CommandRunRecord {
  id: string;
  actionId?: string | null;
  projectId: string;
  command: string;
  cwd: string;
  output: string;
  riskLevel?: RiskLevel;
  exitCode: number | null;
  approvalStatus: ApprovalStatus;
  createdAt: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  protected?: boolean;
}

export interface ActionProposal<TPayload = unknown> {
  id: string;
  projectId: string;
  actionType: ActionRecord['actionType'];
  description: string;
  riskLevel: RiskLevel;
  status: ApprovalStatus;
  approvalRequired: boolean;
  payload: TPayload;
  createdAt: string;
  updatedAt: string;
}

export interface FileWritePayload {
  filePath: string;
  beforeContent: string;
  afterContent: string;
  changeType: 'CREATE' | 'UPDATE';
}

export interface CommandProposalPayload {
  command: string;
  cwd: string;
  output: string;
}

export interface AISettings {
  geminiApiKey: string;
  groqApiKey: string;
  ollamaBaseUrl: string;
  selectedProvider: 'gemini' | 'groq' | 'ollama';
  providerMode: 'cloud' | 'local';
  selectedModel: string;
}

export interface PermissionSettings {
  requireCommandApproval: boolean;
  requireFileApproval: boolean;
  protectSensitiveFiles: boolean;
  allowProtectedReadsWithApproval: boolean;
}

export interface AppSettings extends AISettings, PermissionSettings {}

export interface OrchestratorDecision {
  commandType: CommandType;
  nextAgent: AgentName;
  requiredInputs: string[];
  approvalNeeded: boolean;
  explanation: string;
}

export interface RequirementQuestion {
  id: string;
  question: string;
  rationale: string;
}

export interface AgentOutput<TData = unknown> {
  agentName: AgentName;
  summary: string;
  data: TData;
}
