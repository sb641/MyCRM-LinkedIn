import { createFileSessionStore } from '../packages/automation/src/session-store';
import {
  bootstrapLinkedInSession,
  runImportThreads
} from '../packages/automation/src/index';
import { getLinkedInAuthBootstrapState } from '../packages/automation/src/auth-config';
import { getDb } from '../packages/db/src/server/get-db';

async function main() {
  const accountId = process.argv[2] ?? 'local-account';
  const sessionStore = createFileSessionStore();
  const db = await getDb();
  const authState = await getLinkedInAuthBootstrapState();

  try {
    let sessionCapturedAt: number | null = null;

    if (!authState.checks.cdpReachable) {
      process.env.CHROME_CDP_URL = '';
    } else {
      const session = await bootstrapLinkedInSession(accountId, sessionStore);
      sessionCapturedAt = session.capturedAt;
    }

    const result = await runImportThreads(
      {
        provider: 'linkedin-browser',
        accountId
      },
      {
        enableRealBrowserSync: true,
        sessionStore,
        db: db.db,
        sqlite: db.sqlite
      }
    );

    const importedConversations = await db.sqlite.all<{
      linkedin_thread_id: string;
      last_message_date: number | null;
      contact_name: string | null;
    }>(`
      SELECT
        conversations.linkedin_thread_id,
        conversations.last_message_date,
        contacts.name AS contact_name
      FROM conversations
      INNER JOIN contacts ON contacts.id = conversations.contact_id
      WHERE conversations.linkedin_thread_id IS NOT NULL
      ORDER BY conversations.last_message_date DESC
      LIMIT 10
    `);

    console.log(
      JSON.stringify(
        {
          accountId,
          cdpReachable: authState.checks.cdpReachable,
          userDataDir: authState.legacyConfig.userDataDir,
          sessionCapturedAt,
          importedThreadCount: result.threadIds.length,
          importedMessageCount: 'messagesImported' in result ? result.messagesImported ?? 0 : 0,
          importedConversations
        },
        null,
        2
      )
    );
  } finally {
    await db.sqlite.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});