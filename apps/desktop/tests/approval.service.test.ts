import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { ApprovalService } from '../electron/services/approval.service';

const schemaSql = `
CREATE TABLE actions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  status TEXT NOT NULL,
  approval_required INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE command_runs (
  id TEXT PRIMARY KEY,
  action_id TEXT,
  project_id TEXT NOT NULL,
  command TEXT NOT NULL,
  cwd TEXT NOT NULL,
  output TEXT NOT NULL,
  exit_code INTEGER,
  approval_status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  risk_level TEXT NOT NULL
);
CREATE TABLE file_changes (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  change_type TEXT NOT NULL,
  before_content TEXT NOT NULL,
  after_content TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`;

describe('ApprovalService', () => {
  it('stores a pending file write proposal', () => {
    const db = new Database(':memory:');
    db.exec(schemaSql);
    const service = new ApprovalService(db);

    const proposal = service.createFileWriteProposal('project-1', 'Create README', 'MEDIUM', {
      filePath: 'README.md',
      beforeContent: '',
      afterContent: '# Hello',
      changeType: 'CREATE',
    });

    expect(proposal.status).toBe('PENDING');
    expect(service.listPendingActions('project-1')).toHaveLength(1);
  });

  it('stores a pending command proposal', () => {
    const db = new Database(':memory:');
    db.exec(schemaSql);
    const service = new ApprovalService(db);

    const proposal = service.createCommandProposal('project-1', 'Run npm test', 'LOW', {
      command: 'npm test',
      cwd: 'D:\\demo',
      output: '',
    });

    expect(proposal.actionType).toBe('COMMAND');
    expect(service.listPendingActions('project-1')).toHaveLength(1);
    expect(service.getCommandRunByActionId(proposal.id)?.command).toBe('npm test');
  });
});
