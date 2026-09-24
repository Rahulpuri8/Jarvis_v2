import { describe, expect, it } from 'vitest';
import { resolveToolFromIntent } from '../electron/ipc';

describe('Drives, File Inspection & Editor Launch Intent Resolver', () => {
  it('resolves drive storage queries to system.list_drives', () => {
    const res1 = resolveToolFromIntent('how many drives we have');
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('system.list_drives');

    const res2 = resolveToolFromIntent('check drives');
    expect(res2?.tool).toBe('system.list_drives');

    const res3 = resolveToolFromIntent('tell me how many drives we have');
    expect(res3?.tool).toBe('system.list_drives');

    const res4 = resolveToolFromIntent('storage space');
    expect(res4?.tool).toBe('system.list_drives');
  });

  it('resolves folder counting queries to files.list_dir', () => {
    const res1 = resolveToolFromIntent('how many folders are there in that dir');
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('files.list_dir');

    const res2 = resolveToolFromIntent('list folders in d:\\Practice Projects\\Jarvis_V1\\apps');
    expect(res2?.tool).toBe('files.list_dir');
    expect(res2?.arguments?.directory).toBe('d:\\Practice Projects\\Jarvis_V1\\apps');
  });

  it('resolves opening folders in Antigravity IDE and VS Code', () => {
    const res1 = resolveToolFromIntent('open that dir into antigravity');
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('desktop.open_in_editor');
    expect(res1?.arguments?.editor).toBe('antigravity');

    const res2 = resolveToolFromIntent('open that dir into vscode');
    expect(res2).not.toBeNull();
    expect(res2?.tool).toBe('desktop.open_in_editor');
    expect(res2?.arguments?.editor).toBe('vscode');
  });
});
