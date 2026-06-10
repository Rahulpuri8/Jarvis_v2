import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export class SQLiteDatabase {
  private static instance: Database | null = null;

  static getDatabase(appDataPath: string): Database {
    if (this.instance) {
      return this.instance;
    }

    fs.mkdirSync(appDataPath, { recursive: true });
    const filePath = path.join(appDataPath, 'buildos-ai.sqlite');
    this.instance = new Database(filePath);
    this.instance.pragma('journal_mode = WAL');
    this.instance.pragma('foreign_keys = ON');
    return this.instance;
  }
}
