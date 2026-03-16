import { getEnv } from '@mycrm/core';
import { createNodeDb } from './server/node-sqlite';
import {
  accountAliases,
  accounts,
  auditLog,
  contacts,
  conversations,
  drafts,
  draftVariants,
  jobs,
  messages,
  settings,
  syncRuns,
  syncSuppressions
} from './schema';
import { buildSeedData } from './seed-data';

async function insertIfAny<T>(operation: { values: (rows: T[]) => Promise<unknown> }, rows: T[]) {
  if (rows.length === 0) {
    return;
  }

  await operation.values(rows);
}

export async function seedDatabase(databaseUrl?: string) {
  const { db, sqlite } = await createNodeDb(databaseUrl ?? getEnv().DATABASE_URL);
  const seed = buildSeedData();

  await insertIfAny(db.insert(accounts), seed.accounts);
  await insertIfAny(db.insert(accountAliases), seed.accountAliases);
  await insertIfAny(db.insert(contacts), seed.contacts);
  await insertIfAny(db.insert(conversations), seed.conversations);
  await insertIfAny(db.insert(messages), seed.messages);
  await insertIfAny(db.insert(drafts), seed.drafts);
  await insertIfAny(db.insert(draftVariants), seed.draftVariants);
  await insertIfAny(db.insert(jobs), seed.jobs);
  await insertIfAny(db.insert(syncRuns), seed.syncRuns);
  await insertIfAny(db.insert(syncSuppressions), seed.syncSuppressions);
  await insertIfAny(db.insert(settings), seed.settings);
  await insertIfAny(db.insert(auditLog), seed.auditLog);

  await sqlite.exec('SELECT 1');

  await sqlite.close();
}

async function main() {
  await seedDatabase();
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
