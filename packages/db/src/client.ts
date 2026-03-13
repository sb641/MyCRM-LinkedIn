import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { getEnv } from '@mycrm/core';
import * as schema from './schema';

export type SqliteConnection = {
  database: Database;
  filePath?: string;
  close: () => Promise<void>;
  exec: (queryText: string) => Promise<void>;
  all: <T>(queryText: string) => Promise<T[]>;
};
export type DatabaseClient = ReturnType<typeof drizzle<typeof schema>>;

let sqlJsPromise: Promise<SqlJsStatic> | undefined;

function normalizeSqlitePath(databaseUrl: string) {
  return databaseUrl.startsWith('file:') ? databaseUrl.slice(5) : databaseUrl;
}

function getSqlJs() {
  sqlJsPromise ??= initSqlJs();
  return sqlJsPromise;
}

export async function createSqliteConnection(databaseUrl = getEnv().DATABASE_URL): Promise<SqliteConnection> {
  const SQL = await getSqlJs();
  const filePath = normalizeSqlitePath(databaseUrl);
  const buffer = fs.existsSync(filePath) ? fs.readFileSync(filePath) : undefined;
  const database = new SQL.Database(buffer);

  return {
    database,
    filePath,
    close: async () => {
      persistDatabase(database, filePath);
      database.close();
    },
    exec: async (queryText: string) => {
      database.exec(queryText);
      persistDatabase(database, filePath);
    },
    all: async <T>(queryText: string) => selectAll<T>(database, queryText)
  };
}

export async function createDb(databaseUrl?: string): Promise<{ sqlite: SqliteConnection; db: DatabaseClient }> {
  const sqlite = await createSqliteConnection(databaseUrl);

  const client = drizzle(async (queryText, params, method) => {
    sqlite.database.exec('PRAGMA foreign_keys = ON');

    if (method === 'run') {
      const result = execute(sqlite.database, 'run', queryText, params);
      persistDatabase(sqlite.database, sqlite.filePath);
      return { rows: [], ...result };
    }

    const rows = method === 'get'
      ? execute(sqlite.database, 'get', queryText, params)
      : execute(sqlite.database, 'all', queryText, params);
    return { rows: Array.isArray(rows) ? rows : rows ? [rows] : [] };
  }, { schema });

  return {
    sqlite,
    db: client
  };
}

function execute(database: Database, method: 'all', queryText: string, params: unknown[]): unknown[];
function execute(database: Database, method: 'get', queryText: string, params: unknown[]): unknown;
function execute(database: Database, method: 'run', queryText: string, params: unknown[]): { changes: number; lastInsertRowid: number };
function execute(database: Database, method: 'all' | 'get' | 'run', queryText: string, params: unknown[]): unknown[] | unknown | { changes: number; lastInsertRowid: number } {
  const statement = database.prepare(queryText, params as unknown[]);

  try {
    if (method === 'run') {
      statement.step();
      return {
        changes: Number(database.exec('SELECT changes() AS count')[0]?.values[0]?.[0] ?? 0),
        lastInsertRowid: Number(database.exec('SELECT last_insert_rowid() AS id')[0]?.values[0]?.[0] ?? 0)
      };
    }

    const rows: Record<string, unknown>[] = [];
    while (statement.step()) {
      rows.push(statement.getAsObject());
    }

    return method === 'get' ? rows[0] : rows;
  } finally {
    statement.free();
  }
}

function selectAll<T>(database: Database, queryText: string) {
  const result = database.exec(queryText);
  if (result.length === 0) {
    return [];
  }

  const [first] = result;
  return first.values.map((row: unknown[]) =>
    Object.fromEntries(first.columns.map((column: string, index: number) => [column, row[index]])) as T
  );
}

function persistDatabase(database: Database, filePath?: string) {
  if (!filePath || filePath === ':memory:') {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(database.export()));
}
