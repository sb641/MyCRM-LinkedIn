import fs from 'node:fs';
import path from 'node:path';

import { runMigrations } from '../../../packages/db/src/migrate';
import { seedDatabase } from '../../../packages/db/src/seed';

const databasePath = path.resolve(process.cwd(), '.e2e', 'playwright.sqlite');
const databaseUrl = `file:${databasePath}`;

async function main() {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  if (fs.existsSync(databasePath)) {
    fs.rmSync(databasePath, { force: true });
  }

  await runMigrations(databaseUrl);
  await seedDatabase(databaseUrl);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});