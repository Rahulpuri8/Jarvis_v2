declare module 'better-sqlite3' {
  interface Statement<TRow = unknown> {
    run(params?: Record<string, unknown> | unknown, ...rest: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: unknown[]): TRow | undefined;
    all(...params: unknown[]): TRow[];
  }

  interface Database {
    pragma(statement: string): unknown;
    exec(sql: string): this;
    prepare<TRow = unknown>(sql: string): Statement<TRow>;
    close(): void;
  }

  interface DatabaseConstructor {
    new (filename: string, options?: Record<string, unknown>): Database;
  }

  const Database: DatabaseConstructor;
  export default Database;
}
