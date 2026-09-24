import crypto from 'node:crypto';
import os from 'node:os';
import type Database from 'better-sqlite3';
import { DEFAULT_SETTINGS } from '../../../../packages/shared/constants';
import type { AppSettings } from '../../../../packages/shared/types';

const SETTINGS_ID = 'singleton';
const ENC_PREFIX = 'enc:v1:';

const getEncryptionKey = (): Buffer => {
  const secret = (os.hostname() || 'localhost') + ':' + (os.userInfo().username || 'user');
  return crypto.scryptSync(secret, 'buildos-salt-v1', 32);
};

export const encryptSecret = (plainText: string): string => {
  if (!plainText) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${ENC_PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decryptSecret = (cipherText: string): string => {
  if (!cipherText) return '';
  if (!cipherText.startsWith(ENC_PREFIX)) {
    // Legacy unencrypted plaintext fallback
    return cipherText;
  }
  try {
    const raw = cipherText.slice(ENC_PREFIX.length);
    const parts = raw.split(':');
    if (parts.length !== 3) return cipherText;
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
};

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
      geminiApiKey: decryptSecret(row.geminiApiKey),
      groqApiKey: decryptSecret(row.groqApiKey),
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
    const encryptedGeminiKey = encryptSecret(settings.geminiApiKey);
    const encryptedGroqKey = encryptSecret(settings.groqApiKey);

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
        geminiApiKey: encryptedGeminiKey,
        groqApiKey: encryptedGroqKey,
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

  logTokenUsage(provider: string, model: string, promptTokens: number, completionTokens: number, latencyMs: number) {
    const id = 'tok_' + Math.random().toString(36).substring(2, 11);
    const totalTokens = promptTokens + completionTokens;
    const costUsd = Number((totalTokens * 0.000002).toFixed(6));
    const now = new Date().toISOString();

    try {
      this.db
        .prepare(
          `INSERT INTO token_usage (id, provider, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, provider, model, promptTokens, completionTokens, totalTokens, costUsd, latencyMs, now);
    } catch {
      // Ignore if table not yet created
    }
  }

  recordTokenUsage(
    payloadOrProvider:
      | string
      | {
          provider: string;
          model: string;
          promptTokens: number;
          completionTokens: number;
          totalTokens?: number;
          costUsd?: number;
          latencyMs?: number;
        },
    model?: string,
    promptTokens?: number,
    completionTokens?: number,
    latencyMs?: number,
  ) {
    if (typeof payloadOrProvider === 'object') {
      const p = payloadOrProvider;
      return this.logTokenUsage(
        p.provider,
        p.model,
        p.promptTokens,
        p.completionTokens,
        p.latencyMs ?? 500,
      );
    }
    return this.logTokenUsage(payloadOrProvider, model ?? '', promptTokens ?? 0, completionTokens ?? 0, latencyMs ?? 500);
  }

  getTokenAnalytics() {
    try {
      const summary = this.db
        .prepare(
          `SELECT COUNT(*) as recordsCount,
                  COALESCE(SUM(total_tokens), 0) as totalTokens,
                  COALESCE(SUM(cost_usd), 0.0) as totalCostUsd,
                  COALESCE(AVG(latency_ms), 0.0) as avgLatencyMs
           FROM token_usage`,
        )
        .get() as { recordsCount: number; totalTokens: number; totalCostUsd: number; avgLatencyMs: number };

      return {
        recordsCount: summary.recordsCount || 0,
        totalTokens: summary.totalTokens || 0,
        estimatedCostUsd: Number((summary.totalCostUsd || 0).toFixed(4)),
        avgLatencyMs: Math.round(summary.avgLatencyMs || 0),
      };
    } catch {
      return {
        recordsCount: 0,
        totalTokens: 0,
        estimatedCostUsd: 0.0,
        avgLatencyMs: 0,
      };
    }
  }
}
