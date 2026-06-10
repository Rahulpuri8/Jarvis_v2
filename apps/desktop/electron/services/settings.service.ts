import type Database from 'better-sqlite3';
import { DEFAULT_SETTINGS } from '../../../../packages/shared/constants';
import type { AppSettings } from '../../../../packages/shared/types';

const SETTINGS_ID = 'singleton';

export class SettingsService {
  constructor(private readonly db: Database) {}

  getSettings(): AppSettings {
    const row = this.db
      .prepare(
        `SELECT gemini_api_key as geminiApiKey, groq_api_key as groqApiKey, ollama_base_url as ollamaBaseUrl,
                selected_provider as selectedProvider, provider_mode as providerMode, selected_model as selectedModel,
                require_command_approval as requireCommandApproval, require_file_approval as requireFileApproval,
                protect_sensitive_files as protectSensitiveFiles, allow_protected_reads_with_approval as allowProtectedReadsWithApproval
         FROM app_settings
         WHERE id = ?`,
      )
      .get(SETTINGS_ID) as
      | {
          geminiApiKey: string;
          groqApiKey: string;
          ollamaBaseUrl: string;
          selectedProvider: 'gemini' | 'groq' | 'ollama';
          providerMode: 'cloud' | 'local';
          selectedModel: string;
          requireCommandApproval: 0 | 1;
          requireFileApproval: 0 | 1;
          protectSensitiveFiles: 0 | 1;
          allowProtectedReadsWithApproval: 0 | 1;
        }
      | undefined;

    if (!row) {
      return {
        geminiApiKey: '',
        groqApiKey: '',
        ollamaBaseUrl: DEFAULT_SETTINGS.ollamaBaseUrl,
        selectedProvider: DEFAULT_SETTINGS.selectedProvider,
        providerMode: DEFAULT_SETTINGS.providerMode,
        selectedModel: DEFAULT_SETTINGS.selectedModel,
        requireCommandApproval: DEFAULT_SETTINGS.requireCommandApproval,
        requireFileApproval: DEFAULT_SETTINGS.requireFileApproval,
        protectSensitiveFiles: DEFAULT_SETTINGS.protectSensitiveFiles,
        allowProtectedReadsWithApproval: DEFAULT_SETTINGS.allowProtectedReadsWithApproval,
      };
    }

    return {
      geminiApiKey: row.geminiApiKey,
      groqApiKey: row.groqApiKey,
      ollamaBaseUrl: row.ollamaBaseUrl,
      selectedProvider: row.selectedProvider,
      providerMode: row.providerMode,
      selectedModel: row.selectedModel,
      requireCommandApproval: Boolean(row.requireCommandApproval),
      requireFileApproval: Boolean(row.requireFileApproval),
      protectSensitiveFiles: Boolean(row.protectSensitiveFiles),
      allowProtectedReadsWithApproval: Boolean(row.allowProtectedReadsWithApproval),
    };
  }

  saveSettings(settings: AppSettings): AppSettings {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE app_settings
         SET gemini_api_key = @geminiApiKey,
             groq_api_key = @groqApiKey,
             ollama_base_url = @ollamaBaseUrl,
             selected_provider = @selectedProvider,
             provider_mode = @providerMode,
             selected_model = @selectedModel,
             require_command_approval = @requireCommandApproval,
             require_file_approval = @requireFileApproval,
             protect_sensitive_files = @protectSensitiveFiles,
             allow_protected_reads_with_approval = @allowProtectedReadsWithApproval,
             updated_at = @updatedAt
         WHERE id = @id`,
      )
      .run({
        id: SETTINGS_ID,
        geminiApiKey: settings.geminiApiKey,
        groqApiKey: settings.groqApiKey,
        ollamaBaseUrl: settings.ollamaBaseUrl,
        selectedProvider: settings.selectedProvider,
        providerMode: settings.providerMode,
        selectedModel: settings.selectedModel,
        requireCommandApproval: Number(settings.requireCommandApproval),
        requireFileApproval: Number(settings.requireFileApproval),
        protectSensitiveFiles: Number(settings.protectSensitiveFiles),
        allowProtectedReadsWithApproval: Number(settings.allowProtectedReadsWithApproval),
        updatedAt: now,
      });

    return this.getSettings();
  }
}
