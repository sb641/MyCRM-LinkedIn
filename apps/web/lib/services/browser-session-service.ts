import { createFileSessionStore, type SessionState } from '@mycrm/automation';

export async function getBrowserSession(accountId: string) {
  return createFileSessionStore().load(accountId);
}

export async function saveBrowserSession(session: SessionState) {
  await createFileSessionStore().save(session);
  return { accountId: session.accountId, capturedAt: session.capturedAt };
}