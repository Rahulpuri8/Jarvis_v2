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

  async generateStructuredJson<T>(input: GenerateTextInput, schema: GenerateStructuredSchema): Promise<T> {
    const text = await this.generateText({
      ...input,
      userPrompt: `${input.userPrompt}\n\nReturn valid JSON for schema ${schema.name}: ${JSON.stringify(schema.shape)}.`,
    });

    return JSON.parse(text) as T;
  }
}
