import { describe, expect, it } from 'vitest';
import { createProvider } from '@buildos/ai/model-router';

describe('model router', () => {
  it('creates an Ollama provider for local mode', () => {
    const provider = createProvider({
      providerMode: 'local',
      selectedModel: 'qwen2.5-coder:7b',
    });

    expect(provider.name).toBe('ollama');
  });

  it('requires a Gemini key for cloud mode by default', () => {
    expect(() => createProvider({})).toThrow(/Gemini API key/);
  });
});
