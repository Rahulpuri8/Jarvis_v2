import type { AIProvider } from '../ai/providers/ai-provider.interface';
import { workflowPlanSchema } from '../shared/schemas';
import type { AgentOutput, WorkflowPlan, WorkflowStep } from '../shared/types';
import { BaseAgent } from './base';

export interface WorkflowPlannerInput {
  goal: string;
  availableTools?: string[];
}

export const fallbackPlanGenerator = (goal: string): WorkflowPlan => {
  const norm = goal.toLowerCase();
  const steps: WorkflowStep[] = [];

  // Pattern 1: Search and Save / Extract
  // e.g. "search the web for python tutorials and save to notes.txt"
  if (norm.includes('search') && (norm.includes('save to') || norm.includes('write to') || norm.includes('save in'))) {
    const searchMatch = goal.match(/search (?:the web for |for )?([^,]+?)(?: and (?:save|write)|,|$)/i);
    const query = searchMatch ? searchMatch[1].trim() : 'latest news';

    const fileMatch = goal.match(/(?:save|write)(?: to| in)? ([a-zA-Z0-9_\-\.\/\\]+)/i);
    const filePath = fileMatch ? fileMatch[1].trim() : 'search_results.txt';

    steps.push({
      id: 'step_1',
      tool: 'browser.search',
      description: `Search the web for "${query}"`,
      arguments: { query, max_results: 5 },
      outputKey: 'search_output',
    });

    steps.push({
      id: 'step_2',
      tool: 'files.write',
      description: `Save search results to "${filePath}"`,
      arguments: {
        path: filePath,
        content: `Search query: ${query}\nResults:\n{{step_1.results}}`,
      },
      dependsOn: ['step_1'],
    });

    return {
      goal,
      steps,
      estimatedDurationSeconds: 8,
      requiresApproval: false,
      explanation: `Searches the web for "${query}" and saves the formatted findings to "${filePath}".`,
    };
  }

  // Pattern 2: Web Browse -> Screenshot -> Read
  // e.g. "open https://example.com, take a screenshot, and read the webpage"
  if ((norm.startsWith('open http') || norm.startsWith('browse to') || norm.startsWith('go to')) && norm.includes('screenshot')) {
    const urlMatch = goal.match(/(?:browse to|go to|open) (https?:\/\/[^\s,]+|[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,}[^\s,]*)/i);
    const url = urlMatch ? urlMatch[1].trim() : 'https://google.com';

    steps.push({
      id: 'step_1',
      tool: 'browser.open',
      description: `Open browser to ${url}`,
      arguments: { url, headless: false },
    });

    steps.push({
      id: 'step_2',
      tool: 'browser.screenshot',
      description: 'Capture screenshot of the opened webpage',
      arguments: { full_page: false },
      dependsOn: ['step_1'],
    });

    if (norm.includes('read') || norm.includes('extract') || norm.includes('content')) {
      steps.push({
        id: 'step_3',
        tool: 'browser.get_content',
        description: 'Extract text content from the page',
        arguments: { extract_mode: 'text' },
        dependsOn: ['step_1'],
      });
    }

    return {
      goal,
      steps,
      estimatedDurationSeconds: 10,
      requiresApproval: false,
      explanation: `Navigates to ${url} and captures page screenshot and content.`,
    };
  }

  // Pattern 3: Desktop Clean & Focus
  // e.g. "close all except VS Code, open Chrome, and tile VS Code to the left"
  if (norm.includes('close all except') || (norm.includes('close everything except') && norm.includes('open'))) {
    const keepMatch = goal.match(/close (?:all|everything) except ([^,]+?)(?: and |,| then|$)/i);
    const keepApp = keepMatch ? keepMatch[1].trim() : 'code';

    steps.push({
      id: 'step_1',
      tool: 'desktop.close_all_except',
      description: `Close all windows except ${keepApp}`,
      arguments: { keep_app: keepApp },
    });

    const openMatch = goal.match(/(?:and |then )?open ([a-zA-Z0-9_\-]+)/i);
    if (openMatch) {
      const appToOpen = openMatch[1].trim();
      steps.push({
        id: 'step_2',
        tool: 'desktop.open',
        description: `Open ${appToOpen}`,
        arguments: { app_name: appToOpen },
        dependsOn: ['step_1'],
      });
    }

    return {
      goal,
      steps,
      estimatedDurationSeconds: 6,
      requiresApproval: false,
      explanation: `Cleans the workspace and prepares requested applications.`,
    };
  }

  // Pattern 4: System Audit & Screenshot
  // e.g. "take a screenshot and check my system info"
  if (norm.includes('screenshot') && (norm.includes('cpu') || norm.includes('system info') || norm.includes('ram'))) {
    steps.push({
      id: 'step_1',
      tool: 'desktop.screenshot',
      description: 'Take desktop screenshot',
      arguments: {},
    });

    steps.push({
      id: 'step_2',
      tool: 'system.info',
      description: 'Collect CPU, memory, and disk diagnostics',
      arguments: {},
    });

    return {
      goal,
      steps,
      estimatedDurationSeconds: 4,
      requiresApproval: false,
      explanation: 'Captures full workspace screenshot and comprehensive hardware diagnostics.',
    };
  }

  // Pattern 5: Visual UI Grounding & Analysis
  // e.g. "analyze my screen and read visible text" or "find the login button and click it"
  if (norm.includes('screen') && (norm.includes('read') || norm.includes('ocr') || norm.includes('text'))) {
    steps.push({
      id: 'step_1',
      tool: 'vision.analyze_screen',
      description: 'Capture and visually analyze current workspace',
      arguments: {},
      outputKey: 'screen_analysis',
    });

    steps.push({
      id: 'step_2',
      tool: 'vision.read_text',
      description: 'Extract visible on-screen text blocks',
      arguments: {},
      dependsOn: ['step_1'],
    });

    return {
      goal,
      steps,
      estimatedDurationSeconds: 4,
      requiresApproval: false,
      explanation: 'Performs visual screen inspection and extracts on-screen text via OCR.',
    };
  }

  // Generic two-step fallback
  steps.push({
    id: 'step_1',
    tool: 'system.info',
    description: 'Query system context',
    arguments: {},
  });

  return {
    goal,
    steps,
    estimatedDurationSeconds: 5,
    requiresApproval: false,
    explanation: `Executing task: ${goal}`,
  };
};

export class WorkflowPlannerAgent extends BaseAgent<WorkflowPlannerInput, WorkflowPlan> {
  constructor(provider: AIProvider | null) {
    super(provider, 'Workflow Planner Agent');
  }

  async run(input: WorkflowPlannerInput): Promise<AgentOutput<WorkflowPlan>> {
    let plan = fallbackPlanGenerator(input.goal);

    if (this.provider) {
      try {
        const availableToolList = input.availableTools?.join(', ') ||
          'desktop.open, desktop.close, desktop.close_all_except, desktop.focus, desktop.minimize, desktop.maximize, desktop.move_window, desktop.type_text, desktop.hotkey, desktop.screenshot, desktop.lock, desktop.brightness, system.info, system.processes, system.notify, system.clipboard_read, system.clipboard_write, files.search, files.info, files.list, files.read, files.write, browser.open, browser.navigate, browser.screenshot, browser.get_content, browser.click, browser.type, browser.scroll, browser.search, browser.close, scheduler.create_timer, scheduler.create_cron, scheduler.list_jobs, scheduler.cancel_job, email.list_unread, email.search, email.read, email.draft, email.send, calendar.list_events, calendar.get_event, calendar.create_event, calendar.delete_event, calendar.today_briefing, memory.store_fact, memory.recall, memory.list_memories, memory.delete_fact, memory.index_document, memory.search_knowledge, voice.speak, voice.listen, voice.status, voice.set_voice, vision.analyze_screen, vision.find_element, vision.click_element, vision.read_text, vision.describe_region, vision.compare_screens';

        plan = await this.provider.generateStructuredJson<WorkflowPlan>(
          {
            systemPrompt: this.buildPrompt(
              `Available tools you can chain:\n${availableToolList}\n\nDecompose the goal into sequential steps. Use {{step_id.key}} for dependent values.`,
            ),
            userPrompt: `Create an execution workflow plan for this goal:\n"${input.goal}"`,
          },
          workflowPlanSchema,
        );
      } catch {
        plan = fallbackPlanGenerator(input.goal);
      }
    }

    return {
      agentName: 'Workflow Planner Agent',
      summary: plan.explanation,
      data: plan,
    };
  }
}
