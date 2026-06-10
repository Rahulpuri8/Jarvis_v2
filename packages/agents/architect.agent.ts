import type { AIProvider } from '../ai/providers/ai-provider.interface';
import type { AgentOutput } from '../shared/types';
import { BaseAgent } from './base';

interface ArchitectInput {
  projectName: string;
}

export class ArchitectAgent extends BaseAgent<ArchitectInput, string> {
  constructor(provider: AIProvider | null) {
    super(provider, 'Architect Agent');
  }

  async run(input: ArchitectInput): Promise<AgentOutput<string>> {
    const content = `# System Architecture

## High-Level Design
- Electron main process owns privileged operations.
- Preload exposes a small typed bridge to the renderer.
- React renderer provides the workspace experience.
- SQLite stores project memory, documents, tasks, approvals, and command history.
- Agent modules generate planning artifacts and proposed actions.

## Core Modules
### Main Process
- IPC router
- Security service
- File system service
- Approval service
- Command runner
- Project memory service
- Settings service

### Renderer
- Home and project selection
- Chat workspace
- File explorer and safe preview
- Documents panel
- Task board
- Approval queue
- Action log and command center
- Settings page

## Data Model
- Projects anchor one selected folder
- Messages capture user and agent conversation history
- Documents store generated markdown artifacts
- Tasks store cross-functional execution work
- Actions store approval lifecycle state
- File changes and command runs store executable proposals and results

## API and IPC Plan
- Project management: create, list, select folder
- File system: get tree, read file, propose write, approve write
- Chat orchestration: send message, list messages, list documents, list tasks
- Command workflow: classify command, propose command, approve command
- Settings: get settings, save settings

## Security Controls
- Enforce selected-folder boundaries on every file path
- Ignore noisy or risky directories by default
- Block sensitive files unless explicitly allowed by policy
- Require approval for file writes and command execution
- Classify command risk before execution

## Key Data Flows
1. User prompt -> Orchestrator -> specialist planning agents -> SQLite documents/tasks
2. Proposed file change -> Action record -> Approval -> File system write
3. Proposed command -> Action record -> Approval -> Command execution -> Logged output

## Future Expansion
- Stronger structured outputs from providers
- Diff viewer for edits
- Model health checks and retries
- Optional git-aware workflows inside the same approval boundary

This architecture is sized correctly for ${input.projectName} as a safe V1 desktop product.`;

    return {
      agentName: 'Architect Agent',
      summary: 'Generated the V1 system architecture.',
      data: content,
    };
  }
}
