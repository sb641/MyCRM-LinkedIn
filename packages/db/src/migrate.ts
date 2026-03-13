import fs from 'node:fs';
import path from 'node:path';
import { createDb } from './client';

export async function runMigrations(databaseUrl?: string) {
  const { sqlite } = await createDb(databaseUrl);
  const migrationSql = fs.readFileSync(path.resolve(import.meta.dirname, '../drizzle/0000_phase1.sql'), 'utf8');
  await sqlite.exec(migrationSql);
  await sqlite.close();
}

if (process.env.NODE_ENV !== 'test') {
  await runMigrations();
}
