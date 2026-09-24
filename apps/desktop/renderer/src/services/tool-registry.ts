/**
 * ToolRegistry — Single source of truth for all JARVIS tool schemas.
 * Each tool self-declares its safety tier:
 *   tier-1: instant execution (safe, reversible ops)
 *   tier-2: AWAITING_CONFIRMATION (destructive / irreversible)
 *   normal: approval gate via Security Panel
 */

export type SafetyTier = 'tier-1' | 'tier-2' | 'normal';

export interface ToolSafety {
  tier: SafetyTier;
  destructive: boolean;
  requiresConfirmation: boolean;
  /** For tier-1 app launches: allowlisted binary names */
  allowedBinaries?: string[];
}

export interface JarvisTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
  safety: ToolSafety;
}

const TOOLS: JarvisTool[] = [
  {
    type: 'function',
    function: {
      name: 'browser_search',
      description:
        'Search the live web for real-time information, products, prices, hardware specs, documentation, or news.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query or keywords to look up online' },
        },
        required: ['query'],
      },
    },
    safety: { tier: 'normal', destructive: false, requiresConfirmation: false },
  },
  {
    type: 'function',
    function: {
      name: 'system_get_telemetry',
      description:
        'Get real-time CPU, RAM/memory usage, GPU, thermals, and load metrics of the host PC.',
      parameters: { type: 'object', properties: {} },
    },
    safety: { tier: 'tier-1', destructive: false, requiresConfirmation: false },
  },
  {
    type: 'function',
    function: {
      name: 'system_list_drives',
      description: 'List storage drives (e.g. C:, D:), disk space, used and free capacity on the host PC.',
      parameters: { type: 'object', properties: {} },
    },
    safety: { tier: 'tier-1', destructive: false, requiresConfirmation: false },
  },
  {
    type: 'function',
    function: {
      name: 'files_list_dir',
      description: 'Count or list folders and files inside a directory or project workspace.',
      parameters: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory path to inspect. Leave empty for the current workspace.',
          },
        },
      },
    },
    safety: { tier: 'tier-1', destructive: false, requiresConfirmation: false },
  },
  {
    type: 'function',
    function: {
      name: 'desktop_open_in_editor',
      description: 'Open a project folder or file in Antigravity IDE or Visual Studio Code.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to folder or file to open' },
          editor: {
            type: 'string',
            enum: ['antigravity', 'vscode'],
            description: 'Editor to launch',
          },
        },
        required: ['path'],
      },
    },
    safety: { tier: 'tier-1', destructive: false, requiresConfirmation: false },
  },
  {
    type: 'function',
    function: {
      name: 'desktop_list_apps',
      description: 'List installed software applications and programs on the host PC.',
      parameters: { type: 'object', properties: {} },
    },
    safety: { tier: 'tier-1', destructive: false, requiresConfirmation: false },
  },
  {
    type: 'function',
    function: {
      name: 'desktop_open_app',
      description:
        'Launch or open a desktop application or Windows utility (e.g. Calculator, Notepad, File Explorer, Windows Settings, Web Browser / Chrome, Spotify).',
      parameters: {
        type: 'object',
        properties: {
          app_name: {
            type: 'string',
            description:
              'Name or binary of the desktop application to launch (e.g. calc.exe, notepad.exe, explorer.exe, ms-settings:, chrome.exe)',
          },
        },
        required: ['app_name'],
      },
    },
    safety: {
      tier: 'tier-1', // tier-1 ONLY for allowedBinaries; others fall to 'normal'
      destructive: false,
      requiresConfirmation: false,
      allowedBinaries: [
        'calc.exe',
        'notepad.exe',
        'explorer.exe',
        'ms-settings:',
        'chrome.exe',
      ],
    },
  },
  {
    type: 'function',
    function: {
      name: 'desktop_close_app',
      description: 'Close or terminate a desktop application process.',
      parameters: {
        type: 'object',
        properties: {
          app_name: { type: 'string', description: 'Name of the desktop application to close' },
        },
        required: ['app_name'],
      },
    },
    safety: { tier: 'normal', destructive: false, requiresConfirmation: false },
  },
  {
    type: 'function',
    function: {
      name: 'system_shutdown',
      description: 'Shutdown the host computer.',
      parameters: { type: 'object', properties: {} },
    },
    safety: { tier: 'tier-2', destructive: true, requiresConfirmation: true },
  },
  {
    type: 'function',
    function: {
      name: 'system_restart',
      description: 'Restart or reboot the host computer.',
      parameters: { type: 'object', properties: {} },
    },
    safety: { tier: 'tier-2', destructive: true, requiresConfirmation: true },
  },
  {
    type: 'function',
    function: {
      name: 'files_delete',
      description: 'Delete a file or directory on the host computer.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The file or folder path to delete' },
        },
        required: ['path'],
      },
    },
    safety: { tier: 'tier-2', destructive: true, requiresConfirmation: true },
  },
];

export class ToolRegistry {
  private tools: Map<string, JarvisTool> = new Map();

  constructor() {
    for (const tool of TOOLS) {
      this.tools.set(tool.function.name, tool);
    }
  }

  /** Get all tools as Ollama-compatible schema (without safety metadata) */
  getOllamaTools(): Array<{ type: string; function: { name: string; description: string; parameters: Record<string, any> } }> {
    return Array.from(this.tools.values()).map((t) => ({
      type: t.type,
      function: t.function,
    }));
  }

  /** Look up a tool by name */
  getTool(name: string): JarvisTool | undefined {
    return this.tools.get(name);
  }

  /** Get the safety classification for a tool call */
  classifyTool(
    toolName: string,
    args: Record<string, any>,
  ): { tier: SafetyTier; tool: JarvisTool | undefined } {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { tier: 'normal', tool: undefined };
    }

    // For desktop_open_app: tier-1 only if binary is in allowlist
    if (tool.safety.allowedBinaries && toolName === 'desktop_open_app') {
      const resolved = this.resolveToAllowedBinary(args.app_name, tool.safety.allowedBinaries);
      if (!resolved) {
        return { tier: 'normal', tool };
      }
    }

    return { tier: tool.safety.tier, tool };
  }

  /** Resolve a fuzzy app name to an allowlisted binary, or null */
  resolveToAllowedBinary(appName: string, allowlist: string[]): string | null {
    if (!appName) return null;
    const raw = appName.trim().toLowerCase();
    const allowSet = new Set(allowlist);

    if (allowSet.has(raw)) return raw;

    // Normalized aliases
    const ALIASES: Record<string, string> = {
      calc: 'calc.exe',
      calculator: 'calc.exe',
      notepad: 'notepad.exe',
      explorer: 'explorer.exe',
      'file explorer': 'explorer.exe',
      settings: 'ms-settings:',
      'windows settings': 'ms-settings:',
      chrome: 'chrome.exe',
      'google chrome': 'chrome.exe',
      browser: 'chrome.exe',
      'default browser': 'chrome.exe',
    };

    if (ALIASES[raw] && allowSet.has(ALIASES[raw])) {
      return ALIASES[raw];
    }

    if (raw.startsWith('ms-settings')) return 'ms-settings:';

    const withExe = `${raw}.exe`;
    if (allowSet.has(withExe)) return withExe;

    return null;
  }

  /** Register a new tool at runtime (for future plug-and-play) */
  registerTool(tool: JarvisTool): void {
    this.tools.set(tool.function.name, tool);
  }

  /** Get all tool names */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /** Check if a tool is tier-2 (needs AWAITING_CONFIRMATION) */
  isTier2(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    return tool?.safety.tier === 'tier-2';
  }
}

// Singleton for use across renderer
export const toolRegistry = new ToolRegistry();
