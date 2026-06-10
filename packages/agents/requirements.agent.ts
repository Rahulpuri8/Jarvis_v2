import type { AIProvider } from '../ai/providers/ai-provider.interface';
import type { AgentOutput, RequirementQuestion } from '../shared/types';
import { BaseAgent } from './base';

interface RequirementAgentInput {
  command: string;
}

const defaultQuestions: RequirementQuestion[] = [
  {
    id: 'primary-goal',
    question: 'What is the main business outcome you want this MVP to achieve in the first 30 days of use?',
    rationale: 'A concrete outcome helps keep the MVP focused and measurable.',
  },
  {
    id: 'integration-provider',
    question: 'Should this MVP target Gmail, Outlook, or stay provider-agnostic for now?',
    rationale: 'Email provider scope changes API design, auth, and compliance work.',
  },
  {
    id: 'important-definition',
    question: 'What counts as an important email: VIP senders, urgent language, labels, specific keywords, or user-defined rules?',
    rationale: 'The classification logic needs a precise business definition.',
  },
  {
    id: 'draft-or-send',
    question: 'Should the system only draft replies for approval in V1, or do you want eventual send-after-approval planned into the design?',
    rationale: 'This determines the safety model, approval flow, and non-goals.',
  },
  {
    id: 'scan-trigger',
    question: 'Should email checking happen manually on demand, on a schedule, or both?',
    rationale: 'Trigger strategy affects jobs, UX, and local runtime design.',
  },
  {
    id: 'single-or-multi-user',
    question: 'Is the MVP for a single local user only, or should we keep the architecture ready for multi-user support later?',
    rationale: 'This changes auth, storage, and tenancy design.',
  },
  {
    id: 'storage-and-history',
    question: 'Should the app store email summaries, draft history, and approval history locally, and if so for how long?',
    rationale: 'Retention affects schema design, privacy posture, and UX.',
  },
  {
    id: 'ai-mode',
    question: 'Do you want cloud AI, local AI, or a hybrid mode for the MVP?',
    rationale: 'Provider mode affects cost, privacy, and hardware assumptions.',
  },
  {
    id: 'safety-rules',
    question: 'What safety rules are mandatory, beyond asking before send: blocked recipients, confidence thresholds, approval on every draft, or audit logs?',
    rationale: 'These rules shape the core trust model of the product.',
  },
  {
    id: 'constraints',
    question: 'Do you have timeline, budget, or stack constraints that should limit the MVP scope?',
    rationale: 'This keeps recommendations realistic for a solo founder V1.',
  },
];

export class RequirementAgent extends BaseAgent<RequirementAgentInput, RequirementQuestion[]> {
  constructor(provider: AIProvider | null) {
    super(provider, 'Requirement Agent');
  }

  async run(input: RequirementAgentInput): Promise<AgentOutput<RequirementQuestion[]>> {
    return {
      agentName: 'Requirement Agent',
      summary: `Collected the next requirement questions for: ${input.command}`,
      data: defaultQuestions,
    };
  }
}
