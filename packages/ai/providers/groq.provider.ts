import type { AIProvider, GenerateTextInput } from './ai-provider.interface';
import type { GenerateStructuredSchema } from '../../shared/schemas';

interface GroqProviderConfig {
  apiKey: string;
  model: string;
}

export class GroqProvider implements AIProvider {
  name = 'groq';

  constructor(private readonly config: GroqProviderConfig) {}

  async generateText(input: GenerateTextInput): Promise<string> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: input.temperature ?? 0.2,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq request failed with ${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return json.choices?.[0]?.message?.content?.trim() ?? '';
  }

  async generateStream(input: GenerateTextInput, onChunk: (chunk: string) => void): Promise<string> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: input.temperature ?? 0.2,
        stream: true,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
      }),
    });

    if (!response.ok || !response.body) {
      return this.generateText(input);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            const text = data.choices?.[0]?.delta?.content || '';
            if (text) {
              fullText += text;
              onChunk(text);
            }
          } catch {
            // Ignore stream parse error
          }
        }
      }
    }

    return fullText.trim();
  }

  async generateStructuredJson<T>(input: GenerateTextInput, schema: GenerateStructuredSchema): Promise<T> {
    const text = await this.generateText({
      ...input,
      userPrompt: `${input.userPrompt}\n\nRespond with JSON matching: ${JSON.stringify(schema.shape)}.`,
    });

    return JSON.parse(text) as T;
  }
}
