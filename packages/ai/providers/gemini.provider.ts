import type { AIProvider, GenerateTextInput } from './ai-provider.interface';
import type { GenerateStructuredSchema } from '../../shared/schemas';

interface GeminiProviderConfig {
  apiKey: string;
  model: string;
}

export class GeminiProvider implements AIProvider {
  name = 'gemini';

  constructor(private readonly config: GeminiProviderConfig) {}

  async generateText(input: GenerateTextInput): Promise<string> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${input.systemPrompt}\n\n${input.userPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: input.temperature ?? 0.2,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini request failed with ${response.status}`);
    }

    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    return json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')?.trim() ?? '';
  }

  async generateStream(input: GenerateTextInput, onChunk: (chunk: string) => void): Promise<string> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:streamGenerateContent?alt=sse&key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${input.systemPrompt}\n\n${input.userPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: input.temperature ?? 0.2,
          },
        }),
      },
    );

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
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              fullText += text;
              onChunk(text);
            }
          } catch {
            // Ignore SSE json parse errors
          }
        }
      }
    }

    return fullText.trim();
  }

  async generateStructuredJson<T>(input: GenerateTextInput, schema: GenerateStructuredSchema): Promise<T> {
    const text = await this.generateText({
      ...input,
      userPrompt: `${input.userPrompt}\n\nReturn valid JSON for schema ${schema.name}: ${JSON.stringify(schema.shape)}.`,
    });

    return JSON.parse(text) as T;
  }
}
