import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { SettingsService, decryptSecret, encryptSecret } from '../electron/services/settings.service';

const settingsSchema = `
CREATE TABLE app_settings (
  id TEXT PRIMARY KEY,
  gemini_api_key TEXT NOT NULL,
  groq_api_key TEXT NOT NULL,
  ollama_base_url TEXT NOT NULL,
  selected_provider TEXT NOT NULL,
  provider_mode TEXT NOT NULL,
  selected_model TEXT NOT NULL,
  require_command_approval INTEGER NOT NULL,
  require_file_approval INTEGER NOT NULL,
  protect_sensitive_files INTEGER NOT NULL,
  allow_protected_reads_with_approval INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO app_settings VALUES (
  'singleton', '', '', 'http://localhost:11434', 'gemini', 'cloud', 'gemini-1.5-pro', 1, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);`;

describe('SettingsService', () => {
  it('loads and saves persistent app settings', () => {
    const db = new Database(':memory:');
    db.exec(settingsSchema);
    const service = new SettingsService(db);

    const saved = service.saveSettings({
      geminiApiKey: 'gem-key',
      groqApiKey: 'groq-key',
      ollamaBaseUrl: 'http://localhost:11434',
      selectedProvider: 'ollama',
      providerMode: 'local',
      selectedModel: 'qwen2.5-coder:7b',
      requireCommandApproval: true,
      requireFileApproval: true,
      protectSensitiveFiles: true,
      allowProtectedReadsWithApproval: false,
    });

    expect(saved.selectedProvider).toBe('ollama');
    expect(saved.allowProtectedReadsWithApproval).toBe(false);
    expect(service.getSettings().geminiApiKey).toBe('gem-key');

    // Verify stored column value in DB is actually encrypted
    const row = db.prepare('SELECT gemini_api_key FROM app_settings WHERE id = ?').get('singleton') as { gemini_api_key: string };
    expect(row.gemini_api_key).not.toBe('gem-key');
    expect(row.gemini_api_key.startsWith('enc:v1:')).toBe(true);
  });

  it('encrypts and decrypts secrets correctly', () => {
    const plain = 'super-secret-api-key-12345';
    const encrypted = encryptSecret(plain);
    expect(encrypted).not.toBe(plain);
    expect(decryptSecret(encrypted)).toBe(plain);
  });

  it('handles legacy unencrypted keys gracefully', () => {
    const legacy = 'legacy-plain-key';
    expect(decryptSecret(legacy)).toBe('legacy-plain-key');
  });
});
