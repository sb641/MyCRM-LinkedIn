import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { getEnv } from '@mycrm/core';
import * as schema from '../schema';

type SqliteBindValue = string | number | bigint | Uint8Array | null;

function resolveMigrationPath() {
  const candidates = [
    path.resolve(process.cwd(), '../../packages/db/drizzle/0000_phase1.sql'),
    path.resolve(process.cwd(), 'packages/db/drizzle/0000_phase1.sql'),
    path.resolve(process.cwd(), 'drizzle/0000_phase1.sql')
  ];

  const migrationPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!migrationPath) {
    throw new Error('Unable to locate packages/db/drizzle/0000_phase1.sql');
  }

  return migrationPath;
}

const migrationSql = fs.readFileSync(resolveMigrationPath(), 'utf8');

export type NodeSqliteConnection = {
  database: DatabaseSync;
  filePath?: string;
  close: () => Promise<void>;
  exec: (queryText: string) => Promise<void>;
  all: <T>(queryText: string) => Promise<T[]>;
};

export type NodeDatabaseClient = ReturnType<typeof drizzle<typeof schema>>;

function normalizeSqlitePath(databaseUrl: string) {
  return databaseUrl.startsWith('file:') ? databaseUrl.slice(5) : databaseUrl;
}

function toSqliteParams(params: unknown[]): SqliteBindValue[] {
  return params.map((param) => {
    if (
      param === null ||
      typeof param === 'string' ||
      typeof param === 'number' ||
      typeof param === 'bigint' ||
      param instanceof Uint8Array
    ) {
      return param;
    }

    if (param instanceof ArrayBuffer) {
      return new Uint8Array(param);
    }

    if (ArrayBuffer.isView(param)) {
      return new Uint8Array(param.buffer, param.byteOffset, param.byteLength);
    }

    if (param instanceof Date) {
      return param.toISOString();
    }

    if (typeof param === 'boolean') {
      return param ? 1 : 0;
    }

    if (param === undefined) {
      return null;
    }

    return JSON.stringify(param);
  });
}

function execute(database: DatabaseSync, method: 'all', queryText: string, params: unknown[]): unknown[];
function execute(database: DatabaseSync, method: 'get', queryText: string, params: unknown[]): unknown;
function execute(database: DatabaseSync, method: 'run', queryText: string, params: unknown[]): { changes: number; lastInsertRowid: number };
function execute(
  database: DatabaseSync,
  method: 'all' | 'get' | 'run',
  queryText: string,
  params: unknown[]
): unknown[] | unknown | { changes: number; lastInsertRowid: number } {
  const statement = database.prepare(queryText);
  const sqliteParams = toSqliteParams(params);

  if (method === 'run') {
    const result = statement.run(...sqliteParams);
    return {
      changes: Number(result.changes ?? 0),
      lastInsertRowid: Number(result.lastInsertRowid ?? 0)
    };
  }

  if (method === 'get') {
    return statement.get(...sqliteParams);
  }

  return statement.all(...sqliteParams);
}

function selectAll<T>(database: DatabaseSync, queryText: string) {
  return database.prepare(queryText).all() as T[];
}

function hasColumn(database: DatabaseSync, tableName: string, columnName: string) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name?: string }>;
  return columns.some((column) => column.name === columnName);
}

function ensureColumn(database: DatabaseSync, tableName: string, columnName: string, definition: string) {
  if (!hasColumn(database, tableName, columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function ensurePhase02Schema(database: DatabaseSync) {
  ensureColumn(database, 'contacts', 'account_id', 'TEXT');
  ensureColumn(database, 'contacts', 'outreach_status', 'TEXT');
  ensureColumn(database, 'contacts', 'next_reminder_at', 'INTEGER');
  ensureColumn(database, 'contacts', 'deleted_at', 'INTEGER');
  ensureColumn(database, 'contacts', 'seniority_bucket', 'TEXT');
  ensureColumn(database, 'contacts', 'buying_role', 'TEXT');
  ensureColumn(database, 'conversations', 'deleted_at', 'INTEGER');
  ensureColumn(database, 'drafts', 'deleted_at', 'INTEGER');
}

function ensureSchema(database: DatabaseSync) {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'jobs'")
    .get() as { name?: string } | undefined;

  if (!row?.name) {
    database.exec(migrationSql);
  }

  ensurePhase02Schema(database);
}

export async function createNodeSqliteConnection(databaseUrl = getEnv().DATABASE_URL): Promise<NodeSqliteConnection> {
  const filePath = normalizeSqlitePath(databaseUrl);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath);
  database.exec('PRAGMA foreign_keys = ON');
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA busy_timeout = 5000');
  ensureSchema(database);

  return {
    database,
    filePath,
    close: async () => {
      database.close();
    },
    exec: async (queryText: string) => {
      database.exec(queryText);
    },
    all: async <T>(queryText: string) => selectAll<T>(database, queryText)
  };
}

export async function createNodeDb(databaseUrl: string) {
  const sqlite = await createNodeSqliteConnection(databaseUrl);
  const db = drizzle(async (queryText, params, method) => {
    sqlite.database.exec('PRAGMA foreign_keys = ON');

    if (method === 'run') {
      const result = execute(sqlite.database, 'run', queryText, params);
      return { rows: [], ...result };
    }

    const rows = method === 'get'
      ? execute(sqlite.database, 'get', queryText, params)
      : execute(sqlite.database, 'all', queryText, params);
    return { rows: Array.isArray(rows) ? rows : rows ? [rows] : [] };
  }, { schema });

  return {
    sqlite,
    db
  };
}