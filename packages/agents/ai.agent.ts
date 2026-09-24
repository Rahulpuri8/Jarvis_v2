import type { AIProvider } from '../ai/providers/ai-provider.interface';
import type { AgentOutput } from '../shared/types';
import { BaseAgent } from './base';

export interface AIAgentInput {
  projectName: string;
  providers?: string[];
  requirements?: string;
}

export class AIAgent extends BaseAgent<AIAgentInput, string> {
  constructor(provider: AIProvider | null) {
    super(provider, 'AI Agent');
  }

  async run(input: AIAgentInput): Promise<AgentOutput<string>> {
    const providersList = (input.providers || ['Gemini', 'Groq', 'Ollama']).join(', ');
    let content = `# AI Integration & Prompt Engineering Strategy

## Provider Routing
- **Supported Providers**: ${providersList}
- **Mode Switching**: Cloud (Gemini / Groq) with seamless local fallback (Ollama)
- **Model Router**: Factory pattern instantiation based on runtime configuration

## Prompt Architecture & Structured Output
- System prompts tailored with domain constraints and context boundaries
- Structured JSON output enforcement via JSON schema validation
- Automatic retry with fallback strategies on schema validation failures
- Token optimization and window management for chat memory

## Tool & Workflow Scaffolding
- Intent classification router mapping prompts to tool calls
- Multi-step workflow decomposition with parameter dependency resolution
- Approval-gated execution pipeline for high-risk actions

## Project Context
${input.requirements || `AI integration plan for ${input.projectName}.`}`;

    if (this.provider) {
      try {
        const response = await this.provider.generateResponse({
          systemPrompt: this.buildPrompt(`Project: ${input.projectName}, Providers: ${providersList}`),
          userPrompt: `Generate an AI provider strategy and prompt design plan for ${input.projectName}.\nRequirements: ${input.requirements || 'N/A'}`,
        });
        if (response) {
          content = response;
        }
      } catch {
        // Fall back to template content if AI call fails
      }
    }

    return {
      agentName: 'AI Agent',
      summary: `Generated AI integration strategy for ${input.projectName}.`,
      data: content,
    };
  }
}
