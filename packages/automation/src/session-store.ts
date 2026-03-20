import fs from 'node:fs/promises';
import path from 'node:path';

export interface SessionState {
  accountId: string;
  cookiesJson: string;
  userAgent: string;
  capturedAt: number;
}

export interface SessionStore {
  load(accountId: string): Promise<SessionState | null>;
  save(session: SessionState): Promise<void>;
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionState>();

  async load(accountId: string): Promise<SessionState | null> {
    return this.sessions.get(accountId) ?? null;
  }

  async save(session: SessionState): Promise<void> {
    this.sessions.set(session.accountId, session);
  }
}

export class FileSessionStore implements SessionStore {
  constructor(private readonly rootDir: string) {}

  private getSessionPath(accountId: string) {
    const safeAccountId = accountId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.rootDir, `${safeAccountId}.json`);
  }

  async load(accountId: string): Promise<SessionState | null> {
    try {
      const raw = await fs.readFile(this.getSessionPath(accountId), 'utf8');
      return JSON.parse(raw) as SessionState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async save(session: SessionState): Promise<void> {
    await fs.mkdir(this.rootDir, { recursive: true });
    await fs.writeFile(this.getSessionPath(session.accountId), JSON.stringify(session, null, 2), 'utf8');
  }
}

async function resolveWorkspaceRoot(startDir = process.cwd()) {
  let currentDir = path.resolve(startDir);

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    const workspacePath = path.join(currentDir, 'pnpm-workspace.yaml');

    try {
      await fs.access(packageJsonPath);
      await fs.access(workspacePath);
      return currentDir;
    } catch {
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        return path.resolve(startDir);
      }

      currentDir = parentDir;
    }
  }
}

export function createFileSessionStore(rootDir?: string): SessionStore {
  if (rootDir) {
    return new FileSessionStore(rootDir);
  }

  return {
    load: async (accountId: string) => {
      const workspaceRoot = await resolveWorkspaceRoot();
      const workspaceStore = new FileSessionStore(path.resolve(workspaceRoot, '.mycrm', 'sessions'));
      return workspaceStore.load(accountId);
    },
    save: async (session: SessionState) => {
      const workspaceRoot = await resolveWorkspaceRoot();
      const workspaceStore = new FileSessionStore(path.resolve(workspaceRoot, '.mycrm', 'sessions'));
      await workspaceStore.save(session);
    }
  };
}