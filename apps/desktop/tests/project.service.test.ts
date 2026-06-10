import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSystemService } from '../electron/services/file-system.service';
import { ProjectService } from '../electron/services/project.service';
import { SecurityService } from '../electron/services/security.service';

describe('ProjectService', () => {
  let db: Database;
  let tempDir: string;

  beforeEach(() => {
    db = new Database(':memory:');
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildos-db-'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('runs migrations and supports CRUD', () => {
    const migrationsDir = path.join(tempDir, 'migrations');
    fs.mkdirSync(migrationsDir);
    fs.writeFileSync(
      path.join(migrationsDir, '001-init.sql'),
      `CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT, description TEXT, folder_path TEXT, status TEXT, created_at TEXT, updated_at TEXT);
       CREATE TABLE messages (id TEXT PRIMARY KEY, project_id TEXT, role TEXT, agent_name TEXT, content TEXT, created_at TEXT);
       CREATE TABLE documents (id TEXT PRIMARY KEY, project_id TEXT, type TEXT, title TEXT, content TEXT, version INTEGER, created_at TEXT, updated_at TEXT);
       CREATE TABLE tasks (id TEXT PRIMARY KEY, project_id TEXT, title TEXT, description TEXT, team TEXT, priority TEXT, status TEXT, dependencies_json TEXT, created_at TEXT, updated_at TEXT);`,
    );

    const service = new ProjectService(db, new FileSystemService(new SecurityService()));
    service.runMigrations(migrationsDir);
    const project = service.createProject('Demo', 'Testing', null);

    service.saveMessage({
      projectId: project.id,
      role: 'assistant',
      agentName: 'System',
      content: 'Hello',
    });

    service.saveDocument({
      projectId: project.id,
      type: 'PRD',
      title: 'PRD',
      content: '# PRD',
      version: 1,
    });

    service.replaceTasks(project.id, [
      {
        title: 'Task',
        description: 'Desc',
        team: 'Product',
        priority: 'P0',
        status: 'TODO',
        dependenciesJson: '[]',
      },
    ]);

    expect(service.listProjects()).toHaveLength(1);
    expect(service.listMessages(project.id)).toHaveLength(1);
    expect(service.listDocuments(project.id)).toHaveLength(1);
    expect(service.listTasks(project.id)).toHaveLength(1);
  });
});
