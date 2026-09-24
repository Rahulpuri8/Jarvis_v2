/**
 * ConversationManager — Handles message history, context window, and summary compression.
 *
 * Instead of hard `messages.slice(-6)`, uses a sliding window with configurable size
 * and compresses older context into a summary message when history grows.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ConversationConfig {
  /** Max recent messages to include in LLM context (default: 10 = 5 exchanges) */
  maxRecentMessages: number;
  /** System prompt prepended to every request */
  systemPrompt: string;
}

const DEFAULT_CONFIG: ConversationConfig = {
  maxRecentMessages: 10,
  systemPrompt: `You are J.A.R.V.I.S, Tony Stark's advanced personal AI operating layer running directly on the user's host PC.
Your local LLM neural inference engine is powered by Ollama running locally at http://127.0.0.1:11434 with models such as qwen2.5-coder:7b.

FORMATTING & PERSONA RULES:
1. Address the user politely as Sir or Ma'am.
2. Keep responses CONCISE, CRISP, and VISUALLY SCANNABLE (maximum 2-3 short paragraphs or bullet points).

GENERAL DISAMBIGUATION & CLARIFICATION POLICY:
- For ANY user query where essential parameters are ambiguous, vague, or missing to provide an accurate and useful answer (such as underspecified product/search queries, ambiguous app targets, vague file operations, or open-ended instructions), DO NOT guess or call tools prematurely.
- Instead, politely ask 1-3 short, crisp, bulleted clarifying questions before calling a tool.
- ONLY skip clarification and call tools immediately when the user's request is already specific, clear, and unambiguous (e.g. direct app launches like 'open calculator', system queries like 'list drives', 'check ollama status', or commands like 'shutdown computer').
- When the user asks about Ollama, its status, or loaded models, call the 'system_ollama_status' tool immediately.
- When the user asks to shutdown, restart, or delete files, emit the corresponding tool call immediately; the orchestrator security gate will manage confirmation with the user.`,
};

export class ConversationManager {
  private config: ConversationConfig;
  private summaryContext: string | null = null;

  constructor(config?: Partial<ConversationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Build the messages array for an Ollama chat request.
   * Takes full message history, returns optimized context window.
   */
  buildContext(
    allMessages: Array<{ role: string; content: string }>,
    currentUserMessage: string,
  ): ChatMessage[] {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.config.systemPrompt },
    ];

    // Add compressed summary of older context if available
    if (this.summaryContext) {
      messages.push({
        role: 'system',
        content: `Previous conversation context: ${this.summaryContext}`,
      });
    }

    // Sliding window: take most recent N messages
    const recent = allMessages.slice(-this.config.maxRecentMessages);
    for (const msg of recent) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    // Current user message
    messages.push({ role: 'user', content: currentUserMessage });

    return messages;
  }

  /**
   * After a successful exchange, check if we should compress older messages.
   * Call this after each assistant reply is appended to history.
   *
   * When history exceeds 2x the window size, the oldest half is
   * summarized into a single context string. Actual summarization
   * via LLM can be added later; for now uses a simple text concat.
   */
  maybeCompress(allMessages: Array<{ role: string; content: string }>): void {
    const threshold = this.config.maxRecentMessages * 2;
    if (allMessages.length <= threshold) return;

    // Messages that will fall outside the sliding window
    const olderMessages = allMessages.slice(
      0,
      allMessages.length - this.config.maxRecentMessages,
    );

    // Simple compression: concatenate key points
    // TODO: Replace with LLM-based summarization for smarter compression
    const summary = olderMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => {
        const prefix = m.role === 'user' ? 'User' : 'JARVIS';
        const truncated =
          m.content.length > 100 ? m.content.slice(0, 100) + '...' : m.content;
        return `${prefix}: ${truncated}`;
      })
      .join(' | ');

    this.summaryContext = summary;
  }

  /** Get the system prompt */
  getSystemPrompt(): string {
    return this.config.systemPrompt;
  }

  /** Update system prompt (e.g., for project-specific context) */
  setSystemPrompt(prompt: string): void {
    this.config.systemPrompt = prompt;
  }

  /** Reset conversation state */
  reset(): void {
    this.summaryContext = null;
  }

  /** Get current config */
  getConfig(): ConversationConfig {
    return { ...this.config };
  }
}
