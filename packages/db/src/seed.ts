import { createDb } from './client';
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
  const { db, sqlite } = await createDb(databaseUrl);
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

  await sqlite.close();
}

if (process.env.NODE_ENV !== 'test') {
  await seedDatabase();
}
