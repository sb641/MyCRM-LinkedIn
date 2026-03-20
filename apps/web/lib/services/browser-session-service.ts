import fs from 'node:fs/promises';
import path from 'node:path';

type SessionState = {
  accountId: string;
  cookiesJson: string;
  userAgent: string;
  capturedAt: number;
};

type BrowserCookie = {
  name?: string;
  value?: string;
  domain?: string;
};

let cachedWorkspaceRoot: string | null = null;

async function getWorkspaceRoot() {
  if (cachedWorkspaceRoot) {
    return cachedWorkspaceRoot;
  }

  let currentDir = path.resolve(__dirname);

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    const workspaceManifestPath = path.join(currentDir, 'pnpm-workspace.yaml');
    const [hasPackageJson, hasWorkspaceManifest] = await Promise.all([
      fs.access(packageJsonPath).then(() => true).catch(() => false),
      fs.access(workspaceManifestPath).then(() => true).catch(() => false)
    ]);

    if (hasPackageJson && hasWorkspaceManifest) {
      cachedWorkspaceRoot = currentDir;
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error('Unable to resolve MyCRM workspace root for browser sessions.');
    }

    currentDir = parentDir;
  }
}

async function getSessionPath(accountId: string) {
  const safeAccountId = accountId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const workspaceRoot = await getWorkspaceRoot();
  return path.join(workspaceRoot, '.mycrm', 'sessions', `${safeAccountId}.json`);
}

export async function getBrowserSession(accountId: string) {
  try {
    const raw = await fs.readFile(await getSessionPath(accountId), 'utf8');
    return JSON.parse(raw) as SessionState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export function hasUsableSavedSession(cookiesJson: string | null | undefined) {
  if (!cookiesJson?.trim()) {
    return false;
  }

  try {
    const parsed = JSON.parse(cookiesJson) as BrowserCookie[];
    if (!Array.isArray(parsed)) {
      return false;
    }

    return parsed.some(
      (cookie) =>
        typeof cookie?.name === 'string' &&
        cookie.name.length > 0 &&
        cookie.name !== 'legacy_profile_imported' &&
        typeof cookie.value === 'string' &&
        cookie.value.length > 0 &&
        (typeof cookie.domain !== 'string' || cookie.domain.includes('linkedin.com'))
    );
  } catch {
    return false;
  }
}

export function hasImportedProfileMarker(cookiesJson: string | null | undefined) {
  if (!cookiesJson?.trim()) {
    return false;
  }

  try {
    const parsed = JSON.parse(cookiesJson) as BrowserCookie[];
    if (!Array.isArray(parsed)) {
      return false;
    }

    return parsed.some((cookie) => cookie?.name === 'legacy_profile_imported');
  } catch {
    return false;
  }
}

export async function saveBrowserSession(session: SessionState) {
  const sessionPath = await getSessionPath(session.accountId);
  await fs.mkdir(path.dirname(sessionPath), { recursive: true });
  await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf8');
  return { accountId: session.accountId, capturedAt: session.capturedAt };
}
