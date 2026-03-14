import { getEnv } from '@mycrm/core';
import { createNodeDb } from './server/node-sqlite';
import {
  auditLog,
  contacts,
  conversations,
  drafts,
  draftVariants,
  jobs,
  messages,
  settings,
  syncRuns
} from './schema';
import { buildSeedData } from './seed-data';

export async function seedDatabase(databaseUrl?: string) {
  const { db, sqlite } = await createNodeDb(databaseUrl ?? getEnv().DATABASE_URL);
  const seed = buildSeedData();

  await db.insert(contacts).values(seed.contacts);
  await db.insert(conversations).values(seed.conversations);
  await db.insert(messages).values(seed.messages);
  await db.insert(drafts).values(seed.drafts);
  await db.insert(draftVariants).values(seed.draftVariants);
  await db.insert(jobs).values(seed.jobs);
  await db.insert(syncRuns).values(seed.syncRuns);
  await db.insert(settings).values(seed.settings);
  await db.insert(auditLog).values(seed.auditLog);

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
