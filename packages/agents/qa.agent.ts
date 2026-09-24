import type { AIProvider } from '../ai/providers/ai-provider.interface';
import type { AgentOutput } from '../shared/types';
import { BaseAgent } from './base';

export interface QAAgentInput {
  projectName: string;
  requirements?: string;
}

export class QAAgent extends BaseAgent<QAAgentInput, string> {
  constructor(provider: AIProvider | null) {
    super(provider, 'QA Agent');
  }

  async run(input: QAAgentInput): Promise<AgentOutput<string>> {
    let content = `# Quality Assurance & Testing Strategy

## Test Automation Framework
- **Unit & Component Testing**: Vitest (TypeScript/React components)
- **Sidecar & Service Testing**: pytest + pytest-asyncio (Python tool runtime)
- **Smoke Testing**: Automated Electron manual smoke scripts

## Testing Coverage Plan
1. **Security & Boundary Validation**:
   - Path traversal prevention unit tests
   - Sensitive file pattern matching tests (`.env`, private keys)
   - Command risk classification test cases
2. **Service & State Integrity**:
   - SQLite migration and settings persistence tests
   - Approval lifecycle state transitions
   - Workflow planner step dependency resolution
3. **Integration Scenarios**:
   - Model router provider initialization
   - IPC handler request/response contracts

## Edge Cases & Error Recovery
- Missing API keys fallback handling
- Timeout recovery for tool runtime sidecar commands
- Database corruption resilience & fallback configuration defaults

## Project Context
${input.requirements || `QA testing plan for ${input.projectName}.`}`;

    if (this.provider) {
      try {
        const response = await this.provider.generateResponse({
          systemPrompt: this.buildPrompt(`Project: ${input.projectName}`),
          userPrompt: `Generate a comprehensive QA testing strategy for ${input.projectName}.\nRequirements: ${input.requirements || 'N/A'}`,
        });
        if (response) {
          content = response;
        }
      } catch {
        // Fall back to template content if AI call fails
      }
    }

    return {
      agentName: 'QA Agent',
      summary: `Generated QA testing plan for ${input.projectName}.`,
      data: content,
    };
  }
}
