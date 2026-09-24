import { exec } from 'node:child_process';
import type Database from 'better-sqlite3';
import { promisify } from 'node:util';
import type { CommandRunRecord } from '../../../../packages/shared/types';
import { SecurityService } from './security.service';
import { resourceMonitor } from './resource-monitor';

const execAsync = promisify(exec);

export class CommandRunnerService {
  constructor(
    private readonly db: Database,
    private readonly securityService: SecurityService,
  ) {}

  async runApprovedCommand(actionId: string): Promise<CommandRunRecord> {
    const pending = this.db
      .prepare(
        `SELECT id, action_id as actionId, project_id as projectId, command, cwd, output, exit_code as exitCode,
                approval_status as approvalStatus, created_at as createdAt, risk_level as riskLevel
         FROM command_runs
         WHERE action_id = ? AND approval_status = 'PENDING'`,
      )
      .get(actionId) as CommandRunRecord | undefined;

    if (!pending) {
      throw new Error('Pending command proposal not found or already processed.');
    }

    const { projectId, command, cwd } = pending;
    if (!this.securityService.isCommandAllowed(command)) {
      throw new Error('Blocked dangerous command.');
    }

    try {
      // Resource Guard: centralized RAM monitor with hysteresis
      await resourceMonitor.applyThrottle();

      const { stdout, stderr } = await execAsync(command, { cwd, windowsHide: true });
      const output = [stdout, stderr].filter(Boolean).join('\n').trim();
      this.db
        .prepare(
          `UPDATE command_runs
           SET output = @output, exit_code = 0, approval_status = 'COMPLETED'
           WHERE action_id = @actionId`,
        )
        .run({ actionId, output });

      return {
        ...pending,
        output,
        exitCode: 0,
        approvalStatus: 'COMPLETED',
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Command execution failed.';
      const exitCode =
        typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: number }).code === 'number'
          ? (error as { code: number }).code
          : 1;

      this.db
        .prepare(
          `UPDATE command_runs
           SET output = @output, exit_code = @exitCode, approval_status = 'FAILED'
           WHERE action_id = @actionId`,
        )
        .run({ actionId, output: message, exitCode });

      return {
        ...pending,
        output: message,
        exitCode,
        approvalStatus: 'FAILED',
      };
    }
  }
}
