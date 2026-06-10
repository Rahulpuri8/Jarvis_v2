CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  gemini_api_key TEXT NOT NULL DEFAULT '',
  groq_api_key TEXT NOT NULL DEFAULT '',
  ollama_base_url TEXT NOT NULL DEFAULT 'http://localhost:11434',
  selected_provider TEXT NOT NULL DEFAULT 'gemini',
  provider_mode TEXT NOT NULL DEFAULT 'cloud',
  selected_model TEXT NOT NULL DEFAULT 'gemini-1.5-pro',
  require_command_approval INTEGER NOT NULL DEFAULT 1,
  require_file_approval INTEGER NOT NULL DEFAULT 1,
  protect_sensitive_files INTEGER NOT NULL DEFAULT 1,
  allow_protected_reads_with_approval INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO app_settings (
  id,
  gemini_api_key,
  groq_api_key,
  ollama_base_url,
  selected_provider,
  provider_mode,
  selected_model,
  require_command_approval,
  require_file_approval,
  protect_sensitive_files,
  allow_protected_reads_with_approval,
  created_at,
  updated_at
) VALUES (
  'singleton',
  '',
  '',
  'http://localhost:11434',
  'gemini',
  'cloud',
  'gemini-1.5-pro',
  1,
  1,
  1,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

ALTER TABLE command_runs ADD COLUMN action_id TEXT;
ALTER TABLE command_runs ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'LOW';
