import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import type { CommandRunRecord, DocumentRecord, MessageRecord, ProjectRecord, TaskRecord } from '../../../../packages/shared/types';
import { FileSystemService } from './file-system.service';

export class ProjectService {
  constructor(
    private readonly db: Database,
    private readonly fileSystemService: FileSystemService,
  ) {}

  runMigrations(migrationsDir: string): void {
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      )`,
    );
    const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      const existing = this.db.prepare(`SELECT id FROM schema_migrations WHERE id = ?`).get(file) as { id: string } | undefined;
      if (existing) {
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      this.db.exec(sql);
      this.db
        .prepare(`INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)`)
        .run(file, new Date().toISOString());
    }
  }

  listProjects(): ProjectRecord[] {
    return this.db
      .prepare(
        `SELECT id, name, description, folder_path as folderPath, status, created_at as createdAt, updated_at as updatedAt
         FROM projects ORDER BY updated_at DESC`,
      )
      .all() as ProjectRecord[];
  }

  createProject(name: string, description: string, folderPath: string | null): ProjectRecord {
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: crypto.randomUUID(),
      name,
      description,
      folderPath,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO projects (id, name, description, folder_path, status, created_at, updated_at)
         VALUES (@id, @name, @description, @folderPath, @status, @createdAt, @updatedAt)`,
      )
      .run(project);

    return project;
  }

  updateProjectFolder(projectId: string, folderPath: string): void {
    this.db
      .prepare(`UPDATE projects SET folder_path = @folderPath, updated_at = @updatedAt WHERE id = @id`)
      .run({ id: projectId, folderPath, updatedAt: new Date().toISOString() });
  }

  getProject(projectId: string): ProjectRecord | null {
    return (
      (this.db
        .prepare(
          `SELECT id, name, description, folder_path as folderPath, status, created_at as createdAt, updated_at as updatedAt
           FROM projects WHERE id = ?`,
        )
        .get(projectId) as ProjectRecord | undefined) ?? null
    );
  }

  getProjectTree(projectId: string) {
    const project = this.getProject(projectId);
    if (!project?.folderPath) {
      return [];
    }

    return this.fileSystemService.getFileTree(project.folderPath);
  }

  readProjectFile(projectId: string, relativePath: string, explicitApproval = false): string {
    const project = this.getProject(projectId);
    if (!project?.folderPath) {
      throw new Error('Project folder is not selected.');
    }

    return this.fileSystemService.readFile(project.folderPath, relativePath, explicitApproval);
  }

  saveMessage(message: Omit<MessageRecord, 'id' | 'createdAt'>): MessageRecord {
    const record: MessageRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...message,
    };

    this.db
      .prepare(
        `INSERT INTO messages (id, project_id, role, agent_name, content, created_at)
         VALUES (@id, @projectId, @role, @agentName, @content, @createdAt)`,
      )
      .run(record);

    return record;
  }

  listMessages(projectId: string): MessageRecord[] {
    return this.db
      .prepare(
        `SELECT id, project_id as projectId, role, agent_name as agentName, content, created_at as createdAt
         FROM messages WHERE project_id = ? ORDER BY created_at ASC`,
      )
      .all(projectId) as MessageRecord[];
  }

  saveDocument(document: Omit<DocumentRecord, 'id' | 'createdAt' | 'updatedAt'>): DocumentRecord {
    const now = new Date().toISOString();
    const record: DocumentRecord = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...document,
    };

    this.db
      .prepare(
        `INSERT INTO documents (id, project_id, type, title, content, version, created_at, updated_at)
         VALUES (@id, @projectId, @type, @title, @content, @version, @createdAt, @updatedAt)`,
      )
      .run(record);

    return record;
  }

  listDocuments(projectId: string): DocumentRecord[] {
    return this.db
      .prepare(
        `SELECT id, project_id as projectId, type, title, content, version, created_at as createdAt, updated_at as updatedAt
         FROM documents WHERE project_id = ? ORDER BY updated_at DESC`,
      )
      .all(projectId) as DocumentRecord[];
  }

  replaceTasks(projectId: string, tasks: Omit<TaskRecord, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>[]): TaskRecord[] {
    this.db.prepare(`DELETE FROM tasks WHERE project_id = ?`).run(projectId);
    const now = new Date().toISOString();
    const statement = this.db.prepare(
      `INSERT INTO tasks (id, project_id, title, description, team, priority, status, dependencies_json, created_at, updated_at)
       VALUES (@id, @projectId, @title, @description, @team, @priority, @status, @dependenciesJson, @createdAt, @updatedAt)`,
    );

    const created = tasks.map((task) => {
      const record: TaskRecord = {
        id: crypto.randomUUID(),
        projectId,
        createdAt: now,
        updatedAt: now,
        ...task,
      };
      statement.run(record);
      return record;
    });

    return created;
  }

  listTasks(projectId: string): TaskRecord[] {
    return this.db
      .prepare(
        `SELECT id, project_id as projectId, title, description, team, priority, status, dependencies_json as dependenciesJson,
                created_at as createdAt, updated_at as updatedAt
         FROM tasks WHERE project_id = ? ORDER BY priority ASC, created_at ASC`,
      )
      .all(projectId) as TaskRecord[];
  }

  listCommandRuns(projectId: string): CommandRunRecord[] {
    return this.db
      .prepare(
        `SELECT id, action_id as actionId, project_id as projectId, command, cwd, output, exit_code as exitCode,
                approval_status as approvalStatus, created_at as createdAt, risk_level as riskLevel
         FROM command_runs
         WHERE project_id = ?
         ORDER BY created_at DESC`,
      )
      .all(projectId) as CommandRunRecord[];
  }
}
