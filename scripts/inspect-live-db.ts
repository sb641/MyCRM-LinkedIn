import { getDb } from '../packages/db/src/server/get-db';

async function main() {
  const resolved = await getDb();
  const sqlite = resolved.sqlite;
  const tables = ['contacts', 'conversations', 'messages', 'jobs', 'sync_runs'] as const;
  const counts = Object.fromEntries(
    await Promise.all(
      tables.map(async (table) => {
        const [row] = await sqlite.all<{ count: number }>(`select count(*) as count from ${table}`);
        return [table, row?.count ?? 0];
      })
    )
  );

  const conversations = await sqlite.all(`
    select id, contact_id, linkedin_thread_id, last_message_date, last_sender, deleted_at
    from conversations
    order by updated_at desc
    limit 5
  `);

  const contacts = await sqlite.all(`
    select id, name, account_id, linkedin_profile_id, deleted_at
    from contacts
    order by updated_at desc
    limit 5
  `);

  const messages = await sqlite.all(`
    select id, conversation_id, linkedin_message_id, timestamp, sender, substr(content, 1, 80) as content
    from messages
    order by updated_at desc
    limit 5
  `);

  console.log(
    JSON.stringify(
      {
        resolvedDatabasePath: resolved.resolvedDatabasePath,
        resolvedDatabaseUrl: resolved.resolvedDatabaseUrl,
        counts,
        conversations,
        contacts,
        messages
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});