export const APP_NAME = 'BuildOS AI';

export const IGNORED_DIRECTORIES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  'vendor',
] as const;

export const PROTECTED_FILE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /^id_rsa$/i,
  /^id_ed25519$/i,
  /^.+\.pem$/i,
  /^.+\.key$/i,
  /^credentials\.json$/i,
  /^secrets\.json$/i,
] as const;

export const SAFE_COMMAND_PREFIXES = [
  'npm install',
  'npm run dev',
  'npm test',
  'npm run build',
  'pnpm install',
  'pnpm test',
  'yarn install',
  'yarn test',
  'node ',
  'python ',
  'git status',
  'git diff',
] as const;

export const BLOCKED_COMMAND_PATTERNS = [
  /rm\s+-rf/i,
  /del\s+\/s/i,
  /format/i,
  /shutdown/i,
  /restart/i,
  /\bsudo\b/i,
  /chmod\s+777/i,
  /curl.+\|\s*bash/i,
  /wget.+\|\s*bash/i,
  /printenv/i,
  /\benv\b/i,
] as const;

export const DEFAULT_SETTINGS = {
  providerMode: 'cloud' as const,
  selectedProvider: 'gemini' as const,
  selectedModel: 'gemini-1.5-pro',
  geminiModel: 'gemini-1.5-pro',
  groqModel: 'llama-3.1-70b-versatile',
  ollamaModel: 'qwen2.5:3b',
  ollamaBaseUrl: 'http://localhost:11434',
  requireCommandApproval: true,
  requireFileApproval: true,
  protectSensitiveFiles: true,
  allowProtectedReadsWithApproval: true,
};
