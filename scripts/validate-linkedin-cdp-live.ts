import fs from 'node:fs/promises';
import path from 'node:path';
import { createFileSessionStore } from '../packages/automation/src/session-store';
import {
  bootstrapLinkedInSession,
  runImportThreads
} from '../packages/automation/src/index';
import { getLinkedInAuthBootstrapState, isChromeCdpReachable } from '../packages/automation/src/auth-config';
import { getDb } from '../packages/db/src/server/get-db';

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9222;
const CDP_URL = process.env.CHROME_CDP_URL?.trim() || `http://127.0.0.1:${CDP_PORT}`;
const REPORT_PATH = path.resolve('.mycrm', 'logs', 'validate-linkedin-cdp-live.json');

async function main() {
  const accountId = process.argv[2] ?? 'local-account';
  const sessionStore = createFileSessionStore();
  const authState = await getLinkedInAuthBootstrapState();

  const db = await getDb();

  try {
    await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });

    if (!(await isChromeCdpReachable(CDP_URL))) {
      throw new Error(
        `Chrome DevTools is not reachable at ${CDP_URL}. Start your real authenticated Chrome profile with remote debugging first, then rerun this validator.`
      );
    }

    process.env.CHROME_CDP_URL = CDP_URL;

    const session = await bootstrapLinkedInSession(accountId, sessionStore);
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

    if (importedConversations.length < 10) {
      throw new Error(
        `Expected 10 imported LinkedIn conversations, received ${importedConversations.length}.`
      );
    }

    const report = {
      ok: true,
      accountId,
      cdpUrl: CDP_URL,
      userDataDir: authState.legacyConfig.userDataDir ?? null,
      sessionCapturedAt: session.capturedAt,
      importedThreadCount: result.threadIds.length,
      importedMessageCount: 'messagesImported' in result ? result.messagesImported ?? 0 : 0,
      importedConversations
    };

    await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    const report = {
      ok: false,
      accountId,
      cdpUrl: CDP_URL,
      userDataDir: authState.legacyConfig.userDataDir ?? null,
      error: error instanceof Error ? error.stack ?? error.message : String(error)
    };

    await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
    await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    throw error;
  } finally {
    await db.sqlite.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});