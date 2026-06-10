import type { AIProvider } from '../ai/providers/ai-provider.interface';
import type { AgentOutput } from '../shared/types';
import { BaseAgent } from './base';

interface CTOAgentInput {
  projectName: string;
}

export class CTOAgent extends BaseAgent<CTOAgentInput, string> {
  constructor(provider: AIProvider | null) {
    super(provider, 'CTO Agent');
  }

  async run(input: CTOAgentInput): Promise<AgentOutput<string>> {
    const content = `# Tech Stack Recommendation

## Recommended Stack
- Electron for the desktop shell and secure local IPC boundary
- React + TypeScript for the renderer UI
- Tailwind CSS for fast, consistent dashboard styling
- SQLite for local project memory, approvals, and action logs
- Gemini as the primary cloud planning model
- Ollama with qwen2.5-coder:7b for local coding support
- Groq as an optional fast-response cloud fallback

## Why This Stack
- It keeps infrastructure cost low for a V1 demo.
- It supports a strong security model by isolating privileged operations in the Electron main process.
- It gives the product a clean path from offline/local workflows to richer multi-provider orchestration later.

## Tradeoffs
- SQLite is perfect for a local desktop V1, but not a multi-user backend.
- Electron adds app packaging overhead, but it is the right trade for a secure local-first workspace.
- Local models reduce privacy risk and recurring API cost, but they will not match top cloud reasoning models on complex planning tasks.

## Module Direction
- Main process: file system, approvals, commands, database, provider resolution
- Renderer: chat, documents, task board, approvals, logs, settings
- Shared packages: types, constants, prompts, agent contracts
- AI package: provider abstraction and model routing

This direction stays practical for ${input.projectName} while keeping future expansion open.`;

    return {
      agentName: 'CTO Agent',
      summary: 'Created a practical V1 technical direction.',
      data: content,
    };
  }
}
