import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSystemService } from '../electron/services/file-system.service';
import { SecurityService } from '../electron/services/security.service';

describe('FileSystemService', () => {
  const security = new SecurityService();
  const service = new FileSystemService(security);
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildos-files-'));
    fs.mkdirSync(path.join(tempDir, 'src'));
    fs.mkdirSync(path.join(tempDir, 'node_modules'));
    fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), 'export const ok = true;');
    fs.writeFileSync(path.join(tempDir, '.env'), 'SECRET=1');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('builds a safe file tree and ignores blocked folders', () => {
    const tree = service.getFileTree(tempDir);
    expect(tree.some((node) => node.name === 'node_modules')).toBe(false);
    expect(tree.some((node) => node.name === '.env' && node.protected)).toBe(true);
  });

  it('blocks protected files without explicit approval', () => {
    expect(() => service.readFile(tempDir, '.env')).toThrow(/protected/);
  });

  it('reads protected files with explicit approval', () => {
    expect(service.readFile(tempDir, '.env', true)).toContain('SECRET=1');
  });
});
