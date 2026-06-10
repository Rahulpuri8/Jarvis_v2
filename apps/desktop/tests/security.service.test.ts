import { describe, expect, it } from 'vitest';
import { SecurityService } from '../electron/services/security.service';

describe('SecurityService', () => {
  const service = new SecurityService();
  const root = 'D:\\Practice Projects\\Jarvis_V1\\demo-workspace';

  it('keeps resolved paths inside the selected folder', () => {
    const result = service.assertInsideProjectRoot(root, 'src/index.ts');
    expect(result.endsWith('demo-workspace\\src\\index.ts')).toBe(true);
  });

  it('blocks path traversal outside the selected folder', () => {
    expect(() => service.assertInsideProjectRoot(root, '..\\secret.txt')).toThrow(/escapes/);
  });

  it('detects protected files', () => {
    expect(service.isProtectedFile('D:\\project\\.env')).toBe(true);
    expect(service.isProtectedFile('D:\\project\\id_rsa')).toBe(true);
    expect(service.isProtectedFile('D:\\project\\src\\app.ts')).toBe(false);
  });

  it('classifies risky commands correctly', () => {
    expect(service.classifyCommandRisk('npm test')).toBe('LOW');
    expect(service.classifyCommandRisk('npm install')).toBe('MEDIUM');
    expect(service.classifyCommandRisk('git push origin main')).toBe('HIGH');
    expect(service.classifyCommandRisk('rm -rf /')).toBe('CRITICAL');
  });
});
