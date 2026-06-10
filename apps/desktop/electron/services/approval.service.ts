import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  ActionProposal,
  ApprovalStatus,
  CommandProposalPayload,
  CommandRunRecord,
  FileChangeRecord,
  FileWritePayload,
  RiskLevel,
} from '../../../../packages/shared/types';

export class ApprovalService {
  constructor(private readonly db: Database) {}

  createFileWriteProposal(
    projectId: string,
    description: string,
    riskLevel: RiskLevel,
    payload: FileWritePayload,
  ): ActionProposal<FileWritePayload> {
    const now = new Date().toISOString();
    const actionId = crypto.randomUUID();
    const fileChangeId = crypto.randomUUID();

    this.db
      .prepare(
        `INSERT INTO actions (id, project_id, action_type, description, risk_level, status, approval_required, created_at, updated_at)
         VALUES (@id, @projectId, 'FILE_EDIT', @description, @riskLevel, 'PENDING', 1, @createdAt, @updatedAt)`,
      )
      .run({
        id: actionId,
        projectId,
        description,
        riskLevel,
        createdAt: now,
        updatedAt: now,
      });

    this.db
      .prepare(
        `INSERT INTO file_changes (id, action_id, project_id, file_path, change_type, before_content, after_content, status, created_at, updated_at)
         VALUES (@id, @actionId, @projectId, @filePath, @changeType, @beforeContent, @afterContent, 'PENDING', @createdAt, @updatedAt)`,
      )
      .run({
        id: fileChangeId,
        actionId,
        projectId,
        filePath: payload.filePath,
        changeType: payload.changeType,
        beforeContent: payload.beforeContent,
        afterContent: payload.afterContent,
        createdAt: now,
        updatedAt: now,
      });

    return {
      id: actionId,
      projectId,
      actionType: 'FILE_EDIT',
      description,
      riskLevel,
      status: 'PENDING',
      approvalRequired: true,
      payload,
      createdAt: now,
      updatedAt: now,
    };
  }

  createCommandProposal(
    projectId: string,
    description: string,
    riskLevel: RiskLevel,
    payload: CommandProposalPayload,
  ): ActionProposal<CommandProposalPayload> {
    const now = new Date().toISOString();
    const actionId = crypto.randomUUID();
    const commandRunId = crypto.randomUUID();

    this.db
      .prepare(
        `INSERT INTO actions (id, project_id, action_type, description, risk_level, status, approval_required, created_at, updated_at)
         VALUES (@id, @projectId, 'COMMAND', @description, @riskLevel, 'PENDING', 1, @createdAt, @updatedAt)`,
      )
      .run({
        id: actionId,
        projectId,
        description,
        riskLevel,
        createdAt: now,
        updatedAt: now,
      });

    this.db
      .prepare(
        `INSERT INTO command_runs (id, action_id, project_id, command, cwd, output, exit_code, approval_status, created_at, risk_level)
         VALUES (@id, @actionId, @projectId, @command, @cwd, @output, NULL, 'PENDING', @createdAt, @riskLevel)`,
      )
      .run({
        id: commandRunId,
        actionId,
        projectId,
        command: payload.command,
        cwd: payload.cwd,
        output: payload.output,
        createdAt: now,
        riskLevel,
      });

    return {
      id: actionId,
      projectId,
      actionType: 'COMMAND',
      description,
      riskLevel,
      status: 'PENDING',
      approvalRequired: true,
      payload,
      createdAt: now,
      updatedAt: now,
    };
  }

  updateActionStatus(actionId: string, status: ApprovalStatus): void {
    this.db
      .prepare(`UPDATE actions SET status = @status, updated_at = @updatedAt WHERE id = @id`)
      .run({ id: actionId, status, updatedAt: new Date().toISOString() });
    this.db
      .prepare(`UPDATE file_changes SET status = @status, updated_at = @updatedAt WHERE action_id = @id`)
      .run({ id: actionId, status, updatedAt: new Date().toISOString() });
    this.db
      .prepare(`UPDATE command_runs SET approval_status = @status WHERE action_id = @id`)
      .run({ id: actionId, status });
  }

  listPendingActions(projectId: string): Array<ActionProposal<FileWritePayload | CommandProposalPayload>> {
    const actions = this.db
      .prepare(
        `SELECT a.id, a.project_id as projectId, a.action_type as actionType, a.description, a.risk_level as riskLevel,
                a.status, a.approval_required as approvalRequired, a.created_at as createdAt, a.updated_at as updatedAt,
                fc.file_path as filePath, fc.before_content as beforeContent, fc.after_content as afterContent, fc.change_type as changeType,
                cr.command as command, cr.cwd as cwd, cr.output as output
         FROM actions a
         LEFT JOIN file_changes fc ON fc.action_id = a.id
         LEFT JOIN command_runs cr ON cr.action_id = a.id
         WHERE a.project_id = ? AND a.status = 'PENDING'
         ORDER BY a.created_at DESC`,
      )
      .all(projectId) as Array<
      {
        id: string;
        projectId: string;
        actionType: 'FILE_EDIT' | 'COMMAND';
        description: string;
        riskLevel: RiskLevel;
        status: ApprovalStatus;
        approvalRequired: 0 | 1;
        createdAt: string;
        updatedAt: string;
        filePath: string | null;
        beforeContent: string | null;
        afterContent: string | null;
        changeType: 'CREATE' | 'UPDATE' | null;
        command: string | null;
        cwd: string | null;
        output: string | null;
      }
    >;

    return actions.map((action) => {
      if (action.actionType === 'COMMAND') {
        return {
          id: action.id,
          projectId: action.projectId,
          actionType: action.actionType,
          description: action.description,
          riskLevel: action.riskLevel,
          status: action.status,
          approvalRequired: Boolean(action.approvalRequired),
          payload: {
            command: action.command ?? '',
            cwd: action.cwd ?? '',
            output: action.output ?? '',
          },
          createdAt: action.createdAt,
          updatedAt: action.updatedAt,
        };
      }

      return {
        id: action.id,
        projectId: action.projectId,
        actionType: action.actionType,
        description: action.description,
        riskLevel: action.riskLevel,
        status: action.status,
        approvalRequired: Boolean(action.approvalRequired),
        payload: {
          filePath: action.filePath ?? '',
          beforeContent: action.beforeContent ?? '',
          afterContent: action.afterContent ?? '',
          changeType: (action.changeType ?? 'CREATE') as 'CREATE' | 'UPDATE',
        },
        createdAt: action.createdAt,
        updatedAt: action.updatedAt,
      };
    });
  }

  getLatestFileChange(projectId: string, filePath: string): FileChangeRecord | null {
    return (
      (this.db
        .prepare(
          `SELECT id, project_id as projectId, file_path as filePath, change_type as changeType, before_content as beforeContent,
                  after_content as afterContent, status, created_at as createdAt, updated_at as updatedAt
           FROM file_changes
           WHERE project_id = ? AND file_path = ?
           ORDER BY created_at DESC
           LIMIT 1`,
        )
        .get(projectId, filePath) as FileChangeRecord | undefined) ?? null
    );
  }

  getFileChangeByActionId(actionId: string): (FileChangeRecord & { actionId: string }) | null {
    return (
      (this.db
        .prepare(
          `SELECT id, action_id as actionId, project_id as projectId, file_path as filePath, change_type as changeType,
                  before_content as beforeContent, after_content as afterContent, status, created_at as createdAt, updated_at as updatedAt
           FROM file_changes
           WHERE action_id = ?`,
        )
        .get(actionId) as (FileChangeRecord & { actionId: string }) | undefined) ?? null
    );
  }

  getCommandRunByActionId(actionId: string): CommandRunRecord | null {
    return (
      (this.db
        .prepare(
          `SELECT id, action_id as actionId, project_id as projectId, command, cwd, output, exit_code as exitCode,
                  approval_status as approvalStatus, created_at as createdAt, risk_level as riskLevel
           FROM command_runs
           WHERE action_id = ?`,
        )
        .get(actionId) as CommandRunRecord | undefined) ?? null
    );
  }
}
