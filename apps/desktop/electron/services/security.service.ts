import fs from 'node:fs';
import path from 'node:path';
import { BLOCKED_COMMAND_PATTERNS, IGNORED_DIRECTORIES, PROTECTED_FILE_PATTERNS, SAFE_COMMAND_PREFIXES } from '../../../../packages/shared/constants';
import type { RiskLevel } from '../../../../packages/shared/types';

export class SecurityService {
  normalizeFolderPath(folderPath: string): string {
    return path.resolve(folderPath);
  }

  assertInsideProjectRoot(projectRoot: string, candidatePath: string): string {
    const normalizedRoot = this.normalizeFolderPath(projectRoot);
    const normalizedCandidate = path.resolve(normalizedRoot, candidatePath);

    if (normalizedCandidate !== normalizedRoot && !normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)) {
      throw new Error('Path escapes the selected project folder.');
    }

    return normalizedCandidate;
  }

  shouldIgnoreName(name: string): boolean {
    return IGNORED_DIRECTORIES.includes(name as (typeof IGNORED_DIRECTORIES)[number]);
  }

  isProtectedFile(filePath: string): boolean {
    const baseName = path.basename(filePath);
    return PROTECTED_FILE_PATTERNS.some((pattern) => pattern.test(baseName));
  }

  canReadFile(filePath: string, explicitApproval = false): boolean {
    if (this.isProtectedFile(filePath)) {
      return explicitApproval;
    }

    return true;
  }

  listSafeEntries(projectRoot: string, relativePath = ''): string[] {
    const targetPath = this.assertInsideProjectRoot(projectRoot, relativePath);
    return fs
      .readdirSync(targetPath, { withFileTypes: true })
      .filter((entry) => !this.shouldIgnoreName(entry.name))
      .map((entry) => entry.name);
  }

  classifyCommandRisk(command: string): RiskLevel {
    const normalized = command.trim();

    if (BLOCKED_COMMAND_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return 'CRITICAL';
    }

    if (normalized.startsWith('git push') || normalized.startsWith('git commit') || normalized.startsWith('npm publish')) {
      return 'HIGH';
    }

    if (SAFE_COMMAND_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
      return normalized.includes('install') ? 'MEDIUM' : 'LOW';
    }

    return 'HIGH';
  }

  isCommandAllowed(command: string): boolean {
    return this.classifyCommandRisk(command) !== 'CRITICAL';
  }
}
