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

  // Multi-Step Workflow Intent (Chained Actions)
  if (
    normalized.includes(' and then ') ||
    normalized.includes(' then ') ||
    normalized.includes(' after that ') ||
    (normalized.includes(' and ') && (
      (normalized.includes('search') && (normalized.includes('save') || normalized.includes('write'))) ||
      (normalized.includes('screenshot') && (normalized.includes('cpu') || normalized.includes('system') || normalized.includes('info') || normalized.includes('ram'))) ||
      (normalized.includes('close') && normalized.includes('open')) ||
      (normalized.includes('open') && (normalized.includes('screenshot') || normalized.includes('read') || normalized.includes('type') || normalized.includes('tile') || normalized.includes('move')))
    ))
  ) {
    return {
      commandType: 'WORKFLOW_EXECUTION',
      nextAgent: 'Workflow Planner Agent',
      requiredInputs: ['goal'],
      approvalNeeded: false,
      explanation: 'This request requires a multi-step execution plan chained across multiple tools.',
    };
  }

  // Desktop & System Tool Execution Intents
  if (
    normalized.startsWith('open ') ||
    normalized.startsWith('launch ') ||
    normalized.startsWith('start app ') ||
    normalized.startsWith('close ') ||
    normalized.startsWith('kill ') ||
    normalized.startsWith('focus ') ||
    normalized.startsWith('switch to ') ||
    normalized.startsWith('minimize') ||
    normalized.startsWith('maximize') ||
    normalized.startsWith('type ') ||
    normalized.startsWith('press ') ||
    normalized.startsWith('hotkey ') ||
    normalized.includes('screenshot') ||
    normalized.includes('cpu usage') ||
    normalized.includes('system info') ||
    normalized.includes('drives') ||
    normalized.includes('how many drive') ||
    normalized.includes('storage space') ||
    normalized.includes('disk space') ||
    normalized.includes('disk usage') ||
    normalized.includes('how many folder') ||
    normalized.includes('list folder') ||
    normalized.includes('what folder') ||
    normalized.includes('folders in') ||
    (normalized.includes('open') && (normalized.includes('antigravity') || normalized.includes('vscode') || normalized.includes('vs code'))) ||
    normalized.includes('battery') ||
    normalized.includes('list windows') ||
    normalized.includes('running processes') ||
    normalized.includes('set volume') ||
    normalized.includes('volume') ||
    normalized.includes('mute') ||
    normalized.includes('lock screen') ||
    normalized.includes('lock my pc') ||
    normalized.includes('lock computer') ||
    normalized === 'lock' ||
    normalized.includes('brightness') ||
    normalized.includes('copy to clipboard') ||
    normalized.includes('read clipboard') ||
    normalized.includes('close all except') ||
    normalized.includes('close everything except') ||
    normalized.startsWith('browse ') ||
    normalized.startsWith('navigate to ') ||
    normalized.startsWith('go to ') ||
    normalized.startsWith('search for ') ||
    normalized.startsWith('search the web') ||
    normalized.startsWith('search web') ||
    normalized.startsWith('search google') ||
    normalized.startsWith('search duckduckgo') ||
    normalized.startsWith('google ') ||
    (normalized.startsWith('search ') && !normalized.includes('file') && !normalized.includes('folder')) ||
    normalized.includes('webpage') ||
    normalized.includes('read page') ||
    normalized.includes('extract page') ||
    normalized.includes('scrape page') ||
    normalized.includes('close browser') ||
    normalized.includes('scroll down') ||
    normalized.includes('scroll up') ||
    normalized.startsWith('remind me ') ||
    normalized.startsWith('set a timer') ||
    normalized.startsWith('set timer') ||
    normalized.startsWith('set an alarm') ||
    normalized.startsWith('set alarm') ||
    normalized.startsWith('create reminder') ||
    normalized.startsWith('list reminders') ||
    normalized.startsWith('list timers') ||
    normalized.startsWith('list alarms') ||
    normalized.startsWith('list scheduled') ||
    normalized.startsWith('list jobs') ||
    normalized.startsWith('cancel reminder') ||
    normalized.startsWith('cancel timer') ||
    normalized.startsWith('cancel job') ||
    normalized.startsWith('schedule ') ||
    normalized.includes('recurring reminder') ||
    normalized.includes('unread email') ||
    normalized.includes('check my email') ||
    normalized.includes('read email') ||
    normalized.includes('search email') ||
    normalized.includes('inbox') ||
    normalized.startsWith('draft email') ||
    normalized.startsWith('send email') ||
    normalized.includes('calendar') ||
    normalized.includes('my schedule') ||
    normalized.includes('daily briefing') ||
    normalized.includes('today briefing') ||
    normalized.includes('upcoming meeting') ||
    normalized.includes('upcoming event') ||
    normalized.startsWith('schedule meeting') ||
    normalized.startsWith('schedule a meeting') ||
    normalized.startsWith('create meeting') ||
    normalized.startsWith('create event') ||
    normalized.startsWith('remember ') ||
    normalized.startsWith('recall ') ||
    normalized.startsWith('what do you know about') ||
    normalized.startsWith('forget ') ||
    normalized.includes('list memories') ||
    normalized.includes('my preferences') ||
    normalized.includes('show preferences') ||
    normalized.startsWith('index file ') ||
    normalized.startsWith('index note ') ||
    normalized.startsWith('index document ') ||
    normalized.startsWith('search knowledge ') ||
    normalized.startsWith('search my notes ') ||
    normalized.startsWith('search notes for ') ||
    normalized.startsWith('speak ') ||
    normalized.startsWith('say ') ||
    normalized.startsWith('read aloud ') ||
    normalized.startsWith('tell me aloud ') ||
    normalized === 'voice status' ||
    normalized === 'check audio' ||
    normalized === 'listen' ||
    normalized === 'start listening'
  ) {

    return {
      commandType: 'TOOL_EXECUTION',
      nextAgent: 'Tool Runtime Agent',
      requiredInputs: ['tool_name', 'arguments'],
      approvalNeeded: false,
      explanation: 'This request requires direct desktop/system tool execution via the JARVIS Python Tool Runtime.',
    };
  }

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
