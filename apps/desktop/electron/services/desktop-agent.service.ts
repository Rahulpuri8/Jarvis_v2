import { randomUUID } from 'node:crypto';
import type { ToolRequest, ToolResult } from '../../../../packages/shared/types';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: unknown[];
  tool_name?: string;
};

type ToolCall = {
  function?: {
    name?: string;
    arguments?: Record<string, unknown> | string;
  };
};

export interface DesktopAgentResult {
  status: 'completed' | 'pending_approval' | 'failed';
  reply: string;
  steps: number;
  approval?: { id: string; description: string };
}

interface Session {
  messages: ChatMessage[];
  steps: number;
  pending?: { id: string; request: ToolRequest; createdAt: number };
}

const TOOL_NAMES = [
  'files.list_dir',
  'files.read_text',
  'files.search',
  'files.info',
  'files.write_text',
  'files.delete',
  'system.info',
  'system.processes',
  'system.list_drives',
  'desktop.list_apps',
  'desktop.list_windows',
  'desktop.open_in_editor',
  'desktop.open_app',
  'desktop.close_app',
  'git.status',
  'git.log',
  'browser.search',
] as const;

const REQUIRING_APPROVAL_TOOLS = new Set<string>([
  'desktop.close_app',
  'files.delete',
  'files.write_text',
]);

const ALLOWED_APP_BINARIES = new Set<string>([
  'calc',
  'calc.exe',
  'calculator',
  'notepad',
  'notepad.exe',
  'explorer',
  'explorer.exe',
  'ms-settings:',
  'settings',
  'chrome',
  'chrome.exe',
  'code',
  'code.exe',
]);

const MAX_STEPS = 10;

const SYSTEM_PROMPT = `You are J.A.R.V.I.S, an advanced autonomous desktop assistant operating the user's host PC.
Solve the user's task step-by-step using available desktop, system, file, and git tools.
Rules:
1. Always observe actual system, file, or process state using tools before drawing conclusions.
2. Never hallucinate file contents, paths, or telemetry.
3. Observe the result of each action before deciding the next step.
4. When the goal is completed, output a clear, friendly, and concise summary of the result for the user.`;

export class DesktopAgentService {
  private sessions = new Map<string, Session>();

  constructor(
    private readonly executeTool: (request: ToolRequest) => Promise<ToolResult>,
    private readonly chat: (
      messages: ChatMessage[],
      tools: unknown[],
    ) => Promise<{ message?: { content?: string; tool_calls?: ToolCall[] } }> = DesktopAgentService.ollamaChat,
  ) {}

  private static async ollamaChat(messages: ChatMessage[], tools: unknown[]) {
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5-coder:7b',
        messages,
        tools,
        stream: false,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
    return response.json();
  }

  async start(goal: string, activeProjectPath?: string | null): Promise<DesktopAgentResult> {
    if (!goal.trim()) {
      return { status: 'failed', reply: 'Please provide a task or goal, Sir.', steps: 0 };
    }

    const contextPrefix = activeProjectPath
      ? `[Active Workspace Directory: ${activeProjectPath}]\n\n`
      : '';

    const session: Session = {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${contextPrefix}${goal}` },
      ],
      steps: 0,
    };

    return this.run(session);
  }

  async resolveApproval(id: string, approved: boolean): Promise<DesktopAgentResult> {
    const session = this.sessions.get(id);
    if (!session?.pending || session.pending.id !== id) {
      return {
        status: 'failed',
        reply: 'This authorization request has expired or was already resolved.',
        steps: 0,
      };
    }

    this.sessions.delete(id);

    if (Date.now() - session.pending.createdAt > 5 * 60_000) {
      return {
        status: 'failed',
        reply: 'Authorization timed out. Please initiate the request again.',
        steps: session.steps,
      };
    }

    const request = session.pending.request;
    session.pending = undefined;

    if (!approved) {
      return {
        status: 'completed',
        reply: `Action ${request.tool} was cancelled by user. No system modifications were made.`,
        steps: session.steps,
      };
    }

    await this.executeAndObserve(session, request);
    return this.run(session);
  }

  private async executeAndObserve(session: Session, request: ToolRequest): Promise<void> {
    let result: ToolResult;
    try {
      result = await this.executeTool(request);
    } catch (error) {
      result = {
        success: false,
        status: 'failed',
        request_id: request.request_id || randomUUID(),
        message: error instanceof Error ? error.message : String(error),
      };
    }

    session.steps += 1;
    const toolPayload = result.data ? result.data : { message: result.message };
    session.messages.push({
      role: 'tool',
      tool_name: request.tool,
      content: JSON.stringify(toolPayload).slice(0, 4000),
    });
  }

  private isAppAllowed(appName: string): boolean {
    const clean = appName.trim().toLowerCase();
    return ALLOWED_APP_BINARIES.has(clean);
  }

  private async run(session: Session): Promise<DesktopAgentResult> {
    try {
      while (session.steps < MAX_STEPS) {
        const definitions = await this.getTools();
        const response = await this.chat(session.messages, definitions);
        const message = response.message;
        let calls = message?.tool_calls || [];

        // Fallback: parse JSON tool call from content string if Ollama returned text JSON
        if (!calls.length && message?.content) {
          const raw = message.content.trim();
          const nameMatch = raw.match(/"name"\s*:\s*"([a-zA-Z0-9_\.]+)"/);
          if (nameMatch && nameMatch.index !== undefined) {
            const candidate = nameMatch[1];
            if (TOOL_NAMES.includes(candidate as typeof TOOL_NAMES[number])) {
              let toolArgs: Record<string, unknown> = {};
              const argsMatch = raw.slice(nameMatch.index).match(/"arguments"\s*:\s*(\{[\s\S]*?\})/);
              if (argsMatch) {
                try {
                  toolArgs = JSON.parse(argsMatch[1]);
                } catch {}
              }
              calls = [
                {
                  function: {
                    name: candidate,
                    arguments: toolArgs,
                  },
                },
              ];
            }
          }
        }

        if (!calls.length) {
          const reply = message?.content?.trim();
          return reply
            ? { status: 'completed', reply, steps: session.steps }
            : { status: 'failed', reply: 'The assistant concluded without an explicit response.', steps: session.steps };
        }

        const call = calls[0]?.function;
        const name = call?.name || '';

        if (!TOOL_NAMES.includes(name as typeof TOOL_NAMES[number])) {
          return {
            status: 'failed',
            reply: `Requested tool is outside permitted agent capabilities: ${name}`,
            steps: session.steps,
          };
        }

        let args: Record<string, unknown>;
        try {
          args = typeof call?.arguments === 'string' ? JSON.parse(call.arguments) : (call?.arguments || {});
          if (!args || Array.isArray(args) || typeof args !== 'object') throw new Error('Invalid arguments');
        } catch {
          return { status: 'failed', reply: `Invalid parameters supplied for ${name}.`, steps: session.steps };
        }

        session.messages.push({
          role: 'assistant',
          content: message?.content || '',
          tool_calls: [calls[0]],
        });

        const request: ToolRequest = { tool: name, arguments: args };

        // Check if tool requires safety authorization
        let requiresApproval = REQUIRING_APPROVAL_TOOLS.has(name);
        let approvalDescription = '';

        if (name === 'desktop.close_app') {
          approvalDescription = `Terminate application: ${String(args.app_name || 'process')}`;
        } else if (name === 'files.delete') {
          approvalDescription = `Delete file or directory: ${String(args.path || args.file_path || 'target path')}`;
        } else if (name === 'files.write_text') {
          approvalDescription = `Write to file: ${String(args.file_path || args.path || 'file')}`;
        } else if (name === 'desktop.open_app') {
          const appName = String(args.app_name || '');
          if (!this.isAppAllowed(appName)) {
            requiresApproval = true;
            approvalDescription = `Launch non-allowlisted application: ${appName}`;
          }
        }

        if (requiresApproval) {
          const id = randomUUID();
          session.pending = { id, request, createdAt: Date.now() };
          this.sessions.set(id, session);

          return {
            status: 'pending_approval',
            steps: session.steps,
            reply: `Sir, authorization is required to execute: ${approvalDescription}.`,
            approval: { id, description: approvalDescription },
          };
        }

        await this.executeAndObserve(session, request);
      }

      return {
        status: 'failed',
        reply: `Execution stopped after reaching maximum allowable autonomous steps (${MAX_STEPS}).`,
        steps: session.steps,
      };
    } catch (error) {
      return {
        status: 'failed',
        reply: `Autonomous execution error: ${error instanceof Error ? error.message : String(error)}`,
        steps: session.steps,
      };
    }
  }

  private async getTools(): Promise<unknown[]> {
    const DESCRIPTIONS: Record<string, string> = {
      'files.list_dir': 'List files and subfolders inside a directory path.',
      'files.read_text': 'Read the text content of a file.',
      'files.search': 'Search for files matching a pattern inside a directory.',
      'files.info': 'Get size and timestamp metadata for a file or directory.',
      'files.write_text': 'Create or overwrite a file with text content (requires approval).',
      'files.delete': 'Permanently delete a file or folder (requires approval).',
      'system.info': 'Get real-time CPU, RAM, OS, disk, and load metrics.',
      'system.processes': 'List top running processes sorted by memory or CPU.',
      'system.list_drives': 'List local disk drives and remaining free space.',
      'desktop.list_apps': 'List installed software applications.',
      'desktop.list_windows': 'List all currently open desktop windows.',
      'desktop.open_in_editor': 'Open a file or directory in code editor.',
      'desktop.open_app': 'Launch an application or system utility.',
      'desktop.close_app': 'Close or terminate an application process (requires approval).',
      'git.status': 'Get git repository status (modified, staged, untracked files).',
      'git.log': 'Get recent git commit log history.',
      'browser.search': 'Search the web for up-to-date documentation or real-time info.',
    };

    const PARAMS: Record<string, Record<string, string>> = {
      'files.list_dir': { directory: 'string' },
      'files.read_text': { file_path: 'string' },
      'files.search': { directory: 'string', pattern: 'string' },
      'files.info': { file_path: 'string' },
      'files.write_text': { file_path: 'string', content: 'string' },
      'files.delete': { path: 'string' },
      'system.info': {},
      'system.processes': { limit: 'integer', sort_by: 'string' },
      'system.list_drives': {},
      'desktop.list_apps': {},
      'desktop.list_windows': {},
      'desktop.open_in_editor': { path: 'string' },
      'desktop.open_app': { app_name: 'string' },
      'desktop.close_app': { app_name: 'string' },
      'git.status': { repo_path: 'string' },
      'git.log': { repo_path: 'string', limit: 'integer' },
      'browser.search': { query: 'string' },
    };

    return TOOL_NAMES.map((name) => ({
      type: 'function',
      function: {
        name,
        description: DESCRIPTIONS[name] || name,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(PARAMS[name] || {}).map(([key, val]) => [key, { type: val }]),
          ),
          required:
            name === 'files.list_dir'
              ? ['directory']
              : name === 'files.read_text' || name === 'files.info'
              ? ['file_path']
              : name === 'files.write_text'
              ? ['file_path', 'content']
              : name === 'files.delete' || name === 'desktop.open_in_editor'
              ? ['path']
              : name === 'desktop.open_app' || name === 'desktop.close_app'
              ? ['app_name']
              : name === 'browser.search'
              ? ['query']
              : [],
        },
      },
    }));
  }
}
