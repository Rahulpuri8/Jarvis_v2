import type { AIProvider } from '../ai/providers/ai-provider.interface';
import type { AgentOutput } from '../shared/types';
import { BaseAgent } from './base';

export interface BackendAgentInput {
  projectName: string;
  database?: string;
  requirements?: string;
}

export class BackendAgent extends BaseAgent<BackendAgentInput, string> {
  constructor(provider: AIProvider | null) {
    super(provider, 'Backend Agent');
  }

  async run(input: BackendAgentInput): Promise<AgentOutput<string>> {
    const dbType = input.database || 'SQLite / Node.js Process';
    let content = `# Backend & API Design Plan

## Tech Stack & Runtime
- **Runtime**: Node.js 20+ / Python 3.11 sidecar
- **Database Engine**: ${dbType}
- **API Protocol**: IPC / REST / WebSockets
- **Validation**: Pydantic / Zod

## Service Architecture
- **Data Access Layer**: Prepared statements with parameterized inputs
- **Business Logic Services**: Isolated domain service modules (Projects, Approvals, Security, Settings)
- **Background Workers**: Async process queue with retry logic and rate control
- **IPC Gateway**: Type-safe channel endpoints exposed via context bridge

## Security & Data Integrity
- Strict request parameter validation & schema verification
- Transaction isolation for batch operations
- Machine-scoped encryption for sensitive credentials and keys
- Controlled file system sandbox boundaries

## Project Context
${input.requirements || `Custom backend architecture designed for ${input.projectName}.`}`;

    if (this.provider) {
      try {
        const response = await this.provider.generateResponse({
          systemPrompt: this.buildPrompt(`Project: ${input.projectName}, DB: ${dbType}`),
          userPrompt: `Generate a detailed backend service and API plan for ${input.projectName}.\nRequirements: ${input.requirements || 'N/A'}`,
        });
        if (response) {
          content = response;
        }
      } catch {
        // Fall back to template content if AI call fails
      }
    }

    return {
      agentName: 'Backend Agent',
      summary: `Generated backend service architecture for ${input.projectName}.`,
      data: content,
    };
  }
}
