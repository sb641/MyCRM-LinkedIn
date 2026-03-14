import { createNodeSqliteConnection } from './server/node-sqlite';

export async function runMigrations(databaseUrl?: string) {
  const sqlite = await createNodeSqliteConnection(databaseUrl);
  await sqlite.close();
}

async function main() {
  await runMigrations();
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
