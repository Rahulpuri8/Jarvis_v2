import { DEFAULT_SETTINGS } from '../shared/constants';
import type { AIProvider } from './providers/ai-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { OllamaProvider } from './providers/ollama.provider';

export interface ModelRouterConfig {
  geminiApiKey?: string;
  groqApiKey?: string;
  ollamaBaseUrl?: string;
  providerMode?: 'cloud' | 'local';
  selectedProvider?: 'gemini' | 'groq' | 'ollama';
  selectedModel?: string;
}

export const createProvider = (config: ModelRouterConfig): AIProvider => {
  const providerMode = config.providerMode ?? DEFAULT_SETTINGS.providerMode;
  const selectedProvider =
    providerMode === 'local' ? 'ollama' : config.selectedProvider ?? DEFAULT_SETTINGS.selectedProvider;
  const selectedModel = config.selectedModel ?? DEFAULT_SETTINGS.geminiModel;

  if (selectedProvider === 'groq') {
    if (!config.groqApiKey) {
      throw new Error('Groq API key is missing.');
    }

    return new GroqProvider({
      apiKey: config.groqApiKey,
      model: selectedModel || DEFAULT_SETTINGS.groqModel,
    });
  }

  if (selectedProvider === 'ollama') {
    return new OllamaProvider({
      baseUrl: config.ollamaBaseUrl ?? DEFAULT_SETTINGS.ollamaBaseUrl,
      model: selectedModel || DEFAULT_SETTINGS.ollamaModel,
    });
  }

  if (!config.geminiApiKey) {
    throw new Error('Gemini API key is missing.');
  }

  return new GeminiProvider({
    apiKey: config.geminiApiKey,
    model: selectedModel || DEFAULT_SETTINGS.geminiModel,
  });
};
