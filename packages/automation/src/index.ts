import fs from 'node:fs/promises';
import path from 'node:path';

import { sampleContact } from '@mycrm/test-fixtures';
import {
  importThreadsPayloadSchema,
  importThreadsResultSchema,
  sendMessagePayloadSchema,
  sendMessageResultSchema
} from '@mycrm/core';

export interface ThreadSummary {
  id: string;
  title: string;
  participantName: string;
  snippet: string;
  unreadCount: number;
  lastMessageAt: number;
}

export interface MessageRecord {
  id: string;
  threadId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sentAt: number;
}

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

export interface ParsedThreadFixture {
  thread: ThreadSummary;
  messages: MessageRecord[];
}

export interface MessagingProvider {
  listThreads(): Promise<ThreadSummary[]>;
  getThreadMessages(threadId: string): Promise<MessageRecord[]>;
  sendMessage?(threadId: string, message: string): Promise<{ sentAt: number }>;
}

export type BrowserSyncOptions = {
  enableRealBrowserSync: boolean;
  enableRealSend?: boolean;
  sessionStore?: SessionStore;
};

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

export function createFileSessionStore(rootDir?: string) {
  const sessionRoot = rootDir ?? path.resolve(process.cwd(), '.mycrm', 'sessions');
  return new FileSessionStore(sessionRoot);
}

export function parseThreadFixture(html: string): ParsedThreadFixture {
  const threadMatch = html.match(/<section[^>]*data-thread-id="([^"]+)"[^>]*data-title="([^"]+)"[^>]*data-participant="([^"]+)"[^>]*data-snippet="([^"]*)"[^>]*data-unread="(\d+)"[^>]*data-last-message-at="(\d+)"/i);

  if (!threadMatch) {
    throw new Error('Invalid thread fixture: missing thread metadata');
  }

  const messages = Array.from(
    html.matchAll(/<article[^>]*data-message-id="([^"]+)"[^>]*data-direction="(inbound|outbound)"[^>]*data-sent-at="(\d+)"[^>]*>([\s\S]*?)<\/article>/gi)
  ).map((match) => ({
    id: match[1],
    threadId: threadMatch[1],
    direction: match[2] as 'inbound' | 'outbound',
    sentAt: Number(match[3]),
    body: match[4].replace(/<[^>]+>/g, '').trim()
  }));

  return {
    thread: {
      id: threadMatch[1],
      title: threadMatch[2],
      participantName: threadMatch[3],
      snippet: threadMatch[4],
      unreadCount: Number(threadMatch[5]),
      lastMessageAt: Number(threadMatch[6])
    },
    messages
  };
}

export class FakeMessagingProvider implements MessagingProvider {
  constructor(private readonly fixtures: ParsedThreadFixture[]) {}

  async listThreads(): Promise<ThreadSummary[]> {
    return this.fixtures.map((fixture) => fixture.thread);
  }

  async getThreadMessages(threadId: string): Promise<MessageRecord[]> {
    return this.fixtures.find((fixture) => fixture.thread.id === threadId)?.messages ?? [];
  }

  async sendMessage(_threadId: string, _message: string): Promise<{ sentAt: number }> {
    return { sentAt: Date.now() };
  }
}

export class MockMessagingProvider implements MessagingProvider {
  async listThreads(): Promise<ThreadSummary[]> {
    return [
      {
        id: 'thread-1',
        title: `${sampleContact.name} at ${sampleContact.company}`,
        participantName: sampleContact.name,
        snippet: 'Mock thread',
        unreadCount: 0,
        lastMessageAt: 1735689600000
      }
    ];
  }

  async getThreadMessages(threadId: string): Promise<MessageRecord[]> {
    return [
      {
        id: `${threadId}-message-1`,
        threadId,
        direction: 'inbound',
        body: 'Mock thread',
        sentAt: 1735689600000
      }
    ];
  }
}

export class PlaywrightMessagingProvider implements MessagingProvider {
  constructor(private readonly session: SessionState) {}

  async listThreads(): Promise<ThreadSummary[]> {
    throw new Error(`Playwright provider is not implemented yet for account ${this.session.accountId}.`);
  }

  async getThreadMessages(): Promise<MessageRecord[]> {
    throw new Error(`Playwright provider is not implemented yet for account ${this.session.accountId}.`);
  }

  async sendMessage(_threadId: string, _message: string): Promise<{ sentAt: number }> {
    throw new Error(`Playwright send is not implemented yet for account ${this.session.accountId}.`);
  }
}

const defaultImportFixture = parseThreadFixture(`
  <section
    data-thread-id="thread-import-001"
    data-title="${sampleContact.name}"
    data-participant="${sampleContact.name}"
    data-snippet="Checking in on the CRM rebuild"
    data-unread="1"
    data-last-message-at="1735689600000"
  >
    <article data-message-id="message-import-1" data-direction="inbound" data-sent-at="1735689500000">
      Checking in on the CRM rebuild.
    </article>
    <article data-message-id="message-import-2" data-direction="outbound" data-sent-at="1735689600000">
      Thanks, I have a local-first update ready.
    </article>
  </section>
`);

export async function runFakeImportThreads(payload: unknown) {
  const parsed = importThreadsPayloadSchema.parse(payload);
  const provider = new FakeMessagingProvider([defaultImportFixture]);
  const threads = await provider.listThreads();

  return importThreadsResultSchema.parse({
    provider: parsed.provider,
    accountId: parsed.accountId,
    itemsScanned: threads.length,
    itemsImported: threads.length,
    threadIds: threads.map((thread) => thread.id)
  });
}

export async function createBrowserSyncProvider(payload: unknown, options: BrowserSyncOptions): Promise<MessagingProvider> {
  const parsed = importThreadsPayloadSchema.parse(payload);

  if (!options.enableRealBrowserSync) {
    throw new Error('Real browser sync is disabled. Enable ENABLE_REAL_BROWSER_SYNC to use session-backed sync.');
  }

  if (!options.sessionStore) {
    throw new Error('Real browser sync requires a session store.');
  }

  const session = await options.sessionStore.load(parsed.accountId);

  if (!session) {
    throw new Error(`No saved browser session found for account ${parsed.accountId}.`);
  }

  return new PlaywrightMessagingProvider(session);
}

export async function runImportThreads(payload: unknown, options: BrowserSyncOptions) {
  if (!options.enableRealBrowserSync) {
    return runFakeImportThreads(payload);
  }

  const parsed = importThreadsPayloadSchema.parse(payload);
  const provider = await createBrowserSyncProvider(parsed, options);
  const threads = await provider.listThreads();

  return importThreadsResultSchema.parse({
    provider: parsed.provider,
    accountId: parsed.accountId,
    itemsScanned: threads.length,
    itemsImported: threads.length,
    threadIds: threads.map((thread) => thread.id)
  });
}

export async function sendBrowserMessage(payload: unknown, options: BrowserSyncOptions) {
  const parsed = sendMessagePayloadSchema.parse(payload);

  if (!options.enableRealSend) {
    throw new Error('Real send is disabled. Enable ENABLE_REAL_SEND to use browser-backed sending.');
  }

  if (parsed.provider === 'fake-linkedin') {
    const provider = new FakeMessagingProvider([defaultImportFixture]);
    const result = await provider.sendMessage?.(parsed.conversationId, parsed.messageText);

    return sendMessageResultSchema.parse({
      provider: parsed.provider,
      accountId: parsed.accountId,
      draftId: parsed.draftId,
      conversationId: parsed.conversationId,
      sentAt: result?.sentAt ?? Date.now()
    });
  }

  const provider = await createBrowserSyncProvider(
    {
      provider: parsed.provider,
      accountId: parsed.accountId
    },
    {
      enableRealBrowserSync: options.enableRealBrowserSync,
      sessionStore: options.sessionStore
    }
  );

  if (!provider.sendMessage) {
    throw new Error(`Messaging provider does not support send for account ${parsed.accountId}.`);
  }

  const result = await provider.sendMessage(parsed.conversationId, parsed.messageText);

  return sendMessageResultSchema.parse({
    provider: parsed.provider,
    accountId: parsed.accountId,
    draftId: parsed.draftId,
    conversationId: parsed.conversationId,
    sentAt: result.sentAt
  });
}
