import { buildAgentPrompt } from '../ai/prompt-builder';
import type { AIProvider } from '../ai/providers/ai-provider.interface';
import type { AgentName, AgentOutput } from '../shared/types';

export abstract class BaseAgent<TInput, TOutput> {
  constructor(
    protected readonly provider: AIProvider | null,
    protected readonly agentName: AgentName,
  ) {}

  protected buildPrompt(context: string): string {
    return buildAgentPrompt(this.agentName, context);
  }

  abstract run(input: TInput): Promise<AgentOutput<TOutput>>;
}
