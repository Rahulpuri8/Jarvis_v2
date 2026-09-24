import type { AIProvider } from '../ai/providers/ai-provider.interface';
import type { AgentOutput } from '../shared/types';
import { BaseAgent } from './base';

export interface SecurityAgentInput {
  projectName: string;
  requirements?: string;
}

export class SecurityAgent extends BaseAgent<SecurityAgentInput, string> {
  constructor(provider: AIProvider | null) {
    super(provider, 'Security Agent');
  }

  async run(input: SecurityAgentInput): Promise<AgentOutput<string>> {
    let content = `# Security & Threat Model Strategy

## Access Boundary Enforcement
- **Folder Sandbox**: Strict path verification preventing traversal outside selected project directory
- **Sensitive File Protection**: Regex blocking of credential files (`.env`, `*.pem`, `*.key`, `id_rsa`)
- **IPC Sandboxing**: Context isolation enabled, Node integration disabled in Electron web preferences

## Approval-Gated Action Lifecycle
- **Command Risk Classification**: Categorized into LOW, MEDIUM, HIGH, and CRITICAL
- **Blocked Patterns**: Hard block on destructive commands (`rm -rf`, `sudo`, `curl | bash`)
- **File Write Approvals**: Required before modifying disk files with before/after diff verification

## Data Protection
- **Key Storage**: AES-256-GCM encryption for stored LLM API keys
- **Audit Logging**: Comprehensive activity recording for all executed desktop & Python sidecar tools

## Project Context
${input.requirements || `Security posture and risk model for ${input.projectName}.`}`;

    if (this.provider) {
      try {
        const response = await this.provider.generateResponse({
          systemPrompt: this.buildPrompt(`Project: ${input.projectName}`),
          userPrompt: `Generate a detailed security posture and threat model for ${input.projectName}.\nRequirements: ${input.requirements || 'N/A'}`,
        });
        if (response) {
          content = response;
        }
      } catch {
        // Fall back to template content if AI call fails
      }
    }

    return {
      agentName: 'Security Agent',
      summary: `Generated security and threat model plan for ${input.projectName}.`,
      data: content,
    };
  }
}
