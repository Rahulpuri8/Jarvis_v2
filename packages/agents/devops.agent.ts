import type { AIProvider } from '../ai/providers/ai-provider.interface';
import type { AgentOutput } from '../shared/types';
import { BaseAgent } from './base';

export interface DevOpsAgentInput {
  projectName: string;
  requirements?: string;
}

export class DevOpsAgent extends BaseAgent<DevOpsAgentInput, string> {
  constructor(provider: AIProvider | null) {
    super(provider, 'DevOps Agent');
  }

  async run(input: DevOpsAgentInput): Promise<AgentOutput<string>> {
    let content = `# DevOps & Distribution Plan

## Build & Packaging Infrastructure
- **Desktop Bundling**: Vite + TypeScript compiler (`tsc`)
- **Native Bindings**: `electron-rebuild` for native `better-sqlite3` modules
- **Python Sidecar Environment**: Virtual environment isolation (`venv`) with `requirements.txt` freeze

## CI/CD Pipeline (.github/workflows/ci.yml)
- **Automated Validation**: Type checking, linting, Vitest suite execution
- **Python Runtime Testing**: Pytest suite execution across multi-OS runners
- **Build Artifact Verification**: Electron application bundle verification

## Environment & Secrets Management
- Local `.env` management with `.env.example` templates
- Zero cloud credential commitment into git repository history
- Machine-isolated encryption for user configuration settings

## Project Context
${input.requirements || `DevOps deployment and packaging strategy for ${input.projectName}.`}`;

    if (this.provider) {
      try {
        const response = await this.provider.generateResponse({
          systemPrompt: this.buildPrompt(`Project: ${input.projectName}`),
          userPrompt: `Generate a DevOps, CI/CD, and packaging strategy for ${input.projectName}.\nRequirements: ${input.requirements || 'N/A'}`,
        });
        if (response) {
          content = response;
        }
      } catch {
        // Fall back to template content if AI call fails
      }
    }

    return {
      agentName: 'DevOps Agent',
      summary: `Generated DevOps plan for ${input.projectName}.`,
      data: content,
    };
  }
}
