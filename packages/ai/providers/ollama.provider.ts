import type { AIProvider, GenerateTextInput } from './ai-provider.interface';
import type { GenerateStructuredSchema } from '../../shared/schemas';

interface OllamaProviderConfig {
  baseUrl: string;
  model: string;
}

const snakeToCamel = (str: string): string =>
  str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const normalizeKeys = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(normalizeKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc: Record<string, any>, key) => {
      const camelKey = snakeToCamel(key);
      acc[camelKey] = normalizeKeys(obj[key]);
      return acc;
    }, {});
  }
  return obj;
};

const extractJson = (text: string): any => {
  const cleaned = text.replace(/```json\s*|```/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const substring = cleaned.substring(start, end + 1);
      return JSON.parse(substring);
    }
    throw new Error(`Failed to parse JSON from response: ${cleaned}`);
  }
};

export class OllamaProvider implements AIProvider {
  name = 'ollama';

  constructor(private readonly config: OllamaProviderConfig) {}

  async generateText(input: GenerateTextInput & { format?: 'json' }): Promise<string> {
    const payload: Record<string, any> = {
      model: this.config.model,
      stream: false,
      prompt: `${input.systemPrompt}\n\n${input.userPrompt}`,
      options: {
        temperature: input.temperature ?? 0.2,
      },
    };

    if (input.format) {
      payload.format = input.format;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed with ${response.status}: ${response.statusText}`);
      }

      const json = (await response.json()) as { response?: string };
      return json.response?.trim() ?? '';
    } catch (err: any) {
      if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
        throw new Error(`Cannot connect to Ollama at ${this.config.baseUrl}. Make sure the Ollama service is running.`);
      }
      throw err;
    }
  }

  async generateStream(input: GenerateTextInput, onChunk: (chunk: string) => void): Promise<string> {
    const payload = {
      model: this.config.model,
      stream: true,
      prompt: `${input.systemPrompt}\n\n${input.userPrompt}`,
      options: {
        temperature: input.temperature ?? 0.2,
      },
    };

    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
        if (line.trim()) {
          try {
            const data = JSON.parse(line.trim());
            const text = data.response || '';
            if (text) {
              fullText += text;
              onChunk(text);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    return fullText.trim();
  }

  async generateStructuredJson<T>(input: GenerateTextInput, schema: GenerateStructuredSchema): Promise<T> {
    const text = await this.generateText({
      ...input,
      userPrompt: `${input.userPrompt}\n\nYou MUST respond ONLY with a single JSON object matching this schema: ${JSON.stringify(
        schema.shape,
      )}. Do not include any explanation, markdown, or commentary outside the JSON.`,
      format: 'json',
    });

    const parsed = extractJson(text);
    const normalized = normalizeKeys(parsed);
    return normalized as T;
  }
}
