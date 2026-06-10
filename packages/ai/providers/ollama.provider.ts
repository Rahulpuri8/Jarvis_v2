import type { AIProvider, GenerateTextInput } from './ai-provider.interface';
import type { GenerateStructuredSchema } from '../../shared/schemas';

interface OllamaProviderConfig {
  baseUrl: string;
  model: string;
}

export class OllamaProvider implements AIProvider {
  name = 'ollama';

  constructor(private readonly config: OllamaProviderConfig) {}

  async generateText(input: GenerateTextInput): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        stream: false,
        prompt: `${input.systemPrompt}\n\n${input.userPrompt}`,
        options: {
          temperature: input.temperature ?? 0.2,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with ${response.status}`);
    }

    const json = (await response.json()) as { response?: string };
    return json.response?.trim() ?? '';
  }

  async generateStructuredJson<T>(input: GenerateTextInput, schema: GenerateStructuredSchema): Promise<T> {
    const text = await this.generateText({
      ...input,
      userPrompt: `${input.userPrompt}\n\nRespond only as JSON matching: ${JSON.stringify(schema.shape)}.`,
    });

    return JSON.parse(text) as T;
  }
}
