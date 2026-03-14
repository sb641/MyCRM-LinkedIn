import fs from 'node:fs/promises';
import path from 'node:path';

type SessionState = {
  accountId: string;
  cookiesJson: string;
  userAgent: string;
  capturedAt: number;
};

function getSessionPath(accountId: string) {
  const safeAccountId = accountId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.resolve(process.cwd(), '.mycrm', 'sessions', `${safeAccountId}.json`);
}

export async function getBrowserSession(accountId: string) {
  try {
    const raw = await fs.readFile(getSessionPath(accountId), 'utf8');
    return JSON.parse(raw) as SessionState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function saveBrowserSession(session: SessionState) {
  const sessionPath = getSessionPath(session.accountId);
  await fs.mkdir(path.dirname(sessionPath), { recursive: true });
  await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf8');
  return { accountId: session.accountId, capturedAt: session.capturedAt };
}