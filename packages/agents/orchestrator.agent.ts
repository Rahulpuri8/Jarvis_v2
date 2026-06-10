import type { AIProvider } from '../ai/providers/ai-provider.interface';
import { orchestratorDecisionSchema } from '../shared/schemas';
import type { AgentOutput, OrchestratorDecision } from '../shared/types';
import { BaseAgent } from './base';

interface OrchestratorInput {
  message: string;
  projectHasRequirements: boolean;
}

const fallbackDecision = (message: string, projectHasRequirements: boolean): OrchestratorDecision => {
  const normalized = message.toLowerCase();

  if (normalized.includes("let's build") || normalized.includes('build this project')) {
    return {
      commandType: 'NEW_PROJECT_BUILD',
      nextAgent: 'Requirement Agent',
      requiredInputs: ['product_goal', 'target_users', 'mvp_scope'],
      approvalNeeded: false,
      explanation: 'This looks like a new product build request and should start with requirements clarification.',
    };
  }

  if (projectHasRequirements && (normalized.includes('architecture') || normalized.includes('system design'))) {
    return {
      commandType: 'GENERATE_ARCHITECTURE',
      nextAgent: 'Architect Agent',
      requiredInputs: ['approved_requirements'],
      approvalNeeded: false,
      explanation: 'The user is asking for an architecture artifact.',
    };
  }

  if (normalized.includes('review this folder') || normalized.includes('explain this codebase')) {
    return {
      commandType: 'CODEBASE_REVIEW',
      nextAgent: 'CTO Agent',
      requiredInputs: ['selected_folder'],
      approvalNeeded: false,
      explanation: 'This is a codebase exploration request.',
    };
  }

  if (normalized.includes('run ') || normalized.includes('npm ') || normalized.includes('git ')) {
    return {
      commandType: 'RUN_COMMAND',
      nextAgent: 'Security Agent',
      requiredInputs: ['command'],
      approvalNeeded: true,
      explanation: 'Commands must be checked for safety and approved before execution.',
    };
  }

  if (normalized.includes('edit this file')) {
    return {
      commandType: 'EDIT_FILE',
      nextAgent: 'Security Agent',
      requiredInputs: ['file_path', 'edit_request'],
      approvalNeeded: true,
      explanation: 'File edits need a proposal and approval.',
    };
  }

  if (projectHasRequirements && !normalized.includes('?')) {
    return {
      commandType: 'REQUIREMENTS_ANSWER',
      nextAgent: 'PRD Agent',
      requiredInputs: ['approved_requirements'],
      approvalNeeded: false,
      explanation: 'The message appears to continue or answer requirements, so the next step can move into planning artifacts.',
    };
  }

  return {
    commandType: 'GENERAL_QUESTION',
    nextAgent: 'Orchestrator Agent',
    requiredInputs: [],
    approvalNeeded: false,
    explanation: 'This looks like a general workspace question.',
  };
};

export class OrchestratorAgent extends BaseAgent<OrchestratorInput, OrchestratorDecision> {
  constructor(provider: AIProvider | null) {
    super(provider, 'Orchestrator Agent');
  }

  async run(input: OrchestratorInput): Promise<AgentOutput<OrchestratorDecision>> {
    let decision = fallbackDecision(input.message, input.projectHasRequirements);

    if (this.provider) {
      try {
        decision = await this.provider.generateStructuredJson<OrchestratorDecision>(
          {
            systemPrompt: this.buildPrompt(`Project has requirements: ${input.projectHasRequirements}`),
            userPrompt: `Classify this user message: ${input.message}`,
          },
          orchestratorDecisionSchema,
        );
      } catch {
        decision = fallbackDecision(input.message, input.projectHasRequirements);
      }
    }

    return {
      agentName: 'Orchestrator Agent',
      summary: decision.explanation,
      data: decision,
    };
  }
}
