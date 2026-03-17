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

const phase01Tables = [
  'accounts',
  'account_aliases',
  'contacts',
  'reminders',
  'campaigns',
  'campaign_targets',
  'conversations',
  'messages',
  'drafts',
  'draft_variants',
  'jobs',
  'sync_runs',
  'settings',
  'audit_log'
] as const;

const phase01SchemaStatements: Record<(typeof phase01Tables)[number], string> = {
  accounts: `
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      domain TEXT,
      notes TEXT,
      merged_into_account_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS accounts_name_idx ON accounts(name);
    CREATE INDEX IF NOT EXISTS accounts_merged_into_account_id_idx ON accounts(merged_into_account_id);
  `,
  account_aliases: `
    CREATE TABLE account_aliases (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      alias TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS account_aliases_account_alias_idx ON account_aliases(account_id, alias);
    CREATE INDEX IF NOT EXISTS account_aliases_alias_idx ON account_aliases(alias);
  `,
  contacts: `
    CREATE TABLE contacts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      company TEXT,
      position TEXT,
      headline TEXT,
      profile_url TEXT,
      linkedin_profile_id TEXT,
      account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      outreach_status TEXT,
      next_reminder_at INTEGER,
      deleted_at INTEGER,
      seniority_bucket TEXT,
      buying_role TEXT,
      relationship_status TEXT NOT NULL DEFAULT 'new',
      last_interaction_at INTEGER,
      last_reply_at INTEGER,
      last_sent_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS contacts_linkedin_profile_id_idx ON contacts(linkedin_profile_id);
    CREATE INDEX IF NOT EXISTS contacts_relationship_status_idx ON contacts(relationship_status);
    CREATE INDEX IF NOT EXISTS contacts_last_interaction_at_idx ON contacts(last_interaction_at);
  `,
  reminders: `
    CREATE TABLE reminders (
      id TEXT PRIMARY KEY NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'due_today',
      rule_type TEXT NOT NULL DEFAULT 'manual',
      due_at INTEGER NOT NULL,
      completed_at INTEGER,
      note TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS reminders_entity_idx ON reminders(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS reminders_status_due_at_idx ON reminders(status, due_at);
  `,
  campaigns: `
    CREATE TABLE campaigns (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      objective TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      default_prompt TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns(status);
    CREATE INDEX IF NOT EXISTS campaigns_updated_at_idx ON campaigns(updated_at);
  `,
  campaign_targets: `
    CREATE TABLE campaign_targets (
      id TEXT PRIMARY KEY NOT NULL,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS campaign_targets_campaign_contact_idx ON campaign_targets(campaign_id, contact_id);
    CREATE INDEX IF NOT EXISTS campaign_targets_contact_id_idx ON campaign_targets(contact_id);
  `,
  conversations: `
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY NOT NULL,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      linkedin_thread_id TEXT NOT NULL,
      last_message_date INTEGER,
      last_sender TEXT,
      last_synced_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS conversations_linkedin_thread_id_idx ON conversations(linkedin_thread_id);
    CREATE INDEX IF NOT EXISTS conversations_contact_id_idx ON conversations(contact_id);
  `,
  messages: `
    CREATE TABLE messages (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      linkedin_message_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      is_inbound INTEGER NOT NULL,
      raw_payload TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS messages_linkedin_message_id_idx ON messages(linkedin_message_id);
    CREATE INDEX IF NOT EXISTS messages_conversation_timestamp_idx ON messages(conversation_id, timestamp);
  `,
  drafts: `
    CREATE TABLE drafts (
      id TEXT PRIMARY KEY NOT NULL,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      goal_text TEXT NOT NULL,
      approved_text TEXT,
      draft_status TEXT NOT NULL DEFAULT 'none',
      send_status TEXT NOT NULL DEFAULT 'idle',
      model_name TEXT,
      approved_at INTEGER,
      sent_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS drafts_contact_id_idx ON drafts(contact_id);
    CREATE INDEX IF NOT EXISTS drafts_conversation_id_idx ON drafts(conversation_id);
  `,
  draft_variants: `
    CREATE TABLE draft_variants (
      id TEXT PRIMARY KEY NOT NULL,
      draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
      variant_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      selected INTEGER NOT NULL DEFAULT false,
      score INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS draft_variants_draft_variant_idx ON draft_variants(draft_id, variant_index);
  `,
  jobs: `
    CREATE TABLE jobs (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      locked_at INTEGER,
      last_error TEXT,
      scheduled_for INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS jobs_status_scheduled_for_idx ON jobs(status, scheduled_for);
  `,
  sync_runs: `
    CREATE TABLE sync_runs (
      id TEXT PRIMARY KEY NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      items_scanned INTEGER NOT NULL DEFAULT 0,
      items_imported INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );
  `,
  settings: `
    CREATE TABLE settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      is_secret INTEGER NOT NULL DEFAULT false
    );
  `,
  audit_log: `
    CREATE TABLE audit_log (
      id TEXT PRIMARY KEY NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
  `
};

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

function hasTable(database: DatabaseSync, tableName: string) {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name?: string } | undefined;

  return row?.name === tableName;
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

function ensureSyncSuppressionsTable(database: DatabaseSync) {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sync_suppressions'")
    .get() as { name?: string } | undefined;

  if (!row?.name) {
    database.exec(`
      CREATE TABLE sync_suppressions (
        id TEXT PRIMARY KEY,
        contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
        linkedin_profile_id TEXT NOT NULL,
        reason TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        deleted_at INTEGER
      );
      CREATE UNIQUE INDEX IF NOT EXISTS sync_suppressions_linkedin_profile_id_idx
        ON sync_suppressions(linkedin_profile_id);
      CREATE INDEX IF NOT EXISTS sync_suppressions_contact_id_idx
        ON sync_suppressions(contact_id);
    `);
  }
}

function ensurePhase01Schema(database: DatabaseSync) {
  for (const tableName of phase01Tables) {
    if (!hasTable(database, tableName)) {
      database.exec(phase01SchemaStatements[tableName]);
    }
  }
}

function ensureSchema(database: DatabaseSync) {
  ensurePhase01Schema(database);
  ensurePhase02Schema(database);
  ensureSyncSuppressionsTable(database);
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

export async function createNodeDb(databaseUrl = getEnv().DATABASE_URL) {
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