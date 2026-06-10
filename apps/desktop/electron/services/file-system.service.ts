import fs from 'node:fs';
import path from 'node:path';
import type { FileTreeNode } from '../../../../packages/shared/types';
import { SecurityService } from './security.service';

export class FileSystemService {
  constructor(private readonly securityService: SecurityService) {}

  getFileTree(projectRoot: string, relativePath = ''): FileTreeNode[] {
    const absolutePath = this.securityService.assertInsideProjectRoot(projectRoot, relativePath);
    const entries = fs
      .readdirSync(absolutePath, { withFileTypes: true })
      .filter((entry) => !this.securityService.shouldIgnoreName(entry.name))
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));

    return entries.map((entry) => {
      const entryRelativePath = path.relative(projectRoot, path.join(absolutePath, entry.name));
      const absoluteEntryPath = path.join(absolutePath, entry.name);
      const isProtected = this.securityService.isProtectedFile(absoluteEntryPath);

      if (entry.isDirectory()) {
        return {
          name: entry.name,
          path: entryRelativePath,
          type: 'directory',
          children: this.getFileTree(projectRoot, entryRelativePath),
          protected: false,
        };
      }

      return {
        name: entry.name,
        path: entryRelativePath,
        type: 'file',
        protected: isProtected,
      };
    });
  }

  readFile(projectRoot: string, relativePath: string, explicitApproval = false): string {
    const absolutePath = this.securityService.assertInsideProjectRoot(projectRoot, relativePath);

    if (!this.securityService.canReadFile(absolutePath, explicitApproval)) {
      throw new Error('This file is protected and requires explicit approval before reading.');
    }

    return fs.readFileSync(absolutePath, 'utf-8');
  }

  proposeWrite(projectRoot: string, relativePath: string, content: string): { beforeContent: string; afterContent: string } {
    const absolutePath = this.securityService.assertInsideProjectRoot(projectRoot, relativePath);
    const beforeContent = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf-8') : '';
    return {
      beforeContent,
      afterContent: content,
    };
  }

  writeFile(projectRoot: string, relativePath: string, content: string): void {
    const absolutePath = this.securityService.assertInsideProjectRoot(projectRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf-8');
  }
}
