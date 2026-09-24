import type { AIProvider } from '../ai/providers/ai-provider.interface';
import type { AgentOutput } from '../shared/types';
import { BaseAgent } from './base';

export interface FrontendAgentInput {
  projectName: string;
  framework?: string;
  requirements?: string;
}

export class FrontendAgent extends BaseAgent<FrontendAgentInput, string> {
  constructor(provider: AIProvider | null) {
    super(provider, 'Frontend Agent');
  }

  async run(input: FrontendAgentInput): Promise<AgentOutput<string>> {
    const framework = input.framework || 'React 19 + Vite + Tailwind CSS';
    let content = `# Frontend Architecture & UI Plan

## Tech Stack
- **Framework**: ${framework}
- **Language**: TypeScript
- **State Management**: Zustand / React Context
- **Styling**: Tailwind CSS v4 / Vanilla CSS Tokens
- **Icons & Components**: Lucide React / Headless Components

## Core Components
- **Layout Shell**: Navigation header, sidebar, collapsible document panels
- **State Hydration**: Local storage sync, optimistic UI updates
- **Theme & Design System**: Dark mode by default, accessible contrast, smooth transitions

## Performance & UX Strategy
- Code-splitting on route boundaries
- Virtualized lists for heavy data grids or message feeds
- Debounced inputs for live search and filter controls
- Micro-animations for feedback on user actions

## Project Context
${input.requirements || `Custom frontend design tailored for ${input.projectName}.`}`;

    if (this.provider) {
      try {
        const response = await this.provider.generateResponse({
          systemPrompt: this.buildPrompt(`Project: ${input.projectName}, Tech Stack: ${framework}`),
          userPrompt: `Generate a detailed frontend technical design document for ${input.projectName}.\nRequirements: ${input.requirements || 'N/A'}`,
        });
        if (response) {
          content = response;
        }
      } catch {
        // Fall back to template content if AI call fails
      }
    }

    return {
      agentName: 'Frontend Agent',
      summary: `Generated frontend architecture plan for ${input.projectName}.`,
      data: content,
    };
  }
}
