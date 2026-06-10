import type { GenerateStructuredSchema } from '../../shared/schemas';

export interface GenerateTextInput {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export interface AIProvider {
  name: string;
  generateText(input: GenerateTextInput): Promise<string>;
  generateStructuredJson<T>(input: GenerateTextInput, schema: GenerateStructuredSchema): Promise<T>;
}
