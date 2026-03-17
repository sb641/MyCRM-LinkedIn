import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';

import {
  createBrowserSyncProvider,
  createFileSessionStore,
  FakeMessagingProvider,
  InMemorySessionStore,
  MockMessagingProvider,
  PlaywrightMessagingProvider,
  parseThreadFixture,
  sendBrowserMessage,
  runImportThreads,
  runFakeImportThreads
} from './index';
import path from 'node:path';

const sampleFixture = `
  <section
    data-thread-id="thread-42"
    data-title="Alex Morgan"
    data-participant="Alex Morgan"
    data-snippet="Following up on our last note"
    data-unread="2"
    data-last-message-at="1735689600000"
  >
    <article data-message-id="message-1" data-direction="inbound" data-sent-at="1735689500000">
      Hi, circling back on the proposal.
    </article>
    <article data-message-id="message-2" data-direction="outbound" data-sent-at="1735689600000">
      Thanks, I will send an update today.
    </article>
  </section>
`;

describe('automation package', () => {
  const workspaceEnvPath = path.resolve(import.meta.dirname, '../../../.env');

  it('parses a thread fixture into thread and message records', () => {
    const parsed = parseThreadFixture(sampleFixture);

    expect(parsed.thread.id).toBe('thread-42');
    expect(parsed.thread.unreadCount).toBe(2);
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.messages[0]?.direction).toBe('inbound');
  });

  it('lists threads and messages from the fake provider', async () => {
    const provider = new FakeMessagingProvider([parseThreadFixture(sampleFixture)]);

    const threads = await provider.listThreads();
    const messages = await provider.getThreadMessages('thread-42');

    expect(threads).toHaveLength(1);
    expect(threads[0]?.participantName).toBe('Alex Morgan');
    expect(messages).toHaveLength(2);
  });

  it('stores and loads session state in memory', async () => {
    const store = new InMemorySessionStore();

    await store.save({
      accountId: 'account-1',
      cookiesJson: '[]',
      userAgent: 'test-agent',
      capturedAt: 1735689600000
    });

    await expect(store.load('account-1')).resolves.toEqual({
      accountId: 'account-1',
      cookiesJson: '[]',
      userAgent: 'test-agent',
      capturedAt: 1735689600000
    });
  });

  it('stores and loads session state on disk', async () => {
    const store = createFileSessionStore(
      path.resolve(import.meta.dirname, `./tmp-sessions-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    );

    await store.save({
      accountId: 'account-file-1',
      cookiesJson: '[{"name":"li_at"}]',
      userAgent: 'file-agent',
      capturedAt: 1735689600000
    });

    await expect(store.load('account-file-1')).resolves.toEqual({
      accountId: 'account-file-1',
      cookiesJson: '[{"name":"li_at"}]',
      userAgent: 'file-agent',
      capturedAt: 1735689600000
    });
  });

  it('keeps the mock provider deterministic for local development', async () => {
    const provider = new MockMessagingProvider();
    const threads = await provider.listThreads();

    expect(threads[0]?.title).toContain('Alex Morgan');
  });

  it('exposes a guarded Playwright skeleton', async () => {
    const provider = new PlaywrightMessagingProvider({
      accountId: 'account-1',
      cookiesJson: '[]',
      userAgent: 'test-agent',
      capturedAt: 1735689600000
    });

    await expect(provider.listThreads()).rejects.toThrow(/does not contain usable linkedin cookies/i);
  });

  it('rejects invalid session cookie json for the Playwright provider', async () => {
    const provider = new PlaywrightMessagingProvider({
      accountId: 'account-invalid',
      cookiesJson: '{bad json',
      userAgent: 'test-agent',
      capturedAt: 1735689600000
    });

    await expect(provider.listThreads()).rejects.toThrow(/invalid cookies json/i);
  });

  it('rejects real browser sync when the feature flag is disabled', async () => {
    await expect(
      createBrowserSyncProvider(
        { provider: 'linkedin-browser', accountId: 'account-1' },
        { enableRealBrowserSync: false, sessionStore: new InMemorySessionStore() }
      )
    ).rejects.toThrow(/disabled/i);
  });

  it('rejects real browser sync when no saved session exists', async () => {
    const previousCwd = process.cwd();
    const originalEnv = await fs.readFile(workspaceEnvPath, 'utf8').catch(() => null);

    try {
      process.chdir(path.resolve(import.meta.dirname, '../..'));
      await fs.rm(workspaceEnvPath, { force: true });

      await expect(
        createBrowserSyncProvider(
          { provider: 'linkedin-browser', accountId: 'missing-account' },
          { enableRealBrowserSync: true, sessionStore: new InMemorySessionStore() }
        )
      ).rejects.toThrow(/no reusable linkedin browser session|no saved browser session/i);
    } finally {
      process.chdir(previousCwd);
      if (originalEnv !== null) {
        await fs.writeFile(workspaceEnvPath, originalEnv, 'utf8');
      }
    }
  });

  it('prefers a configured CDP session over other browser sync sources', async () => {
    const store = new InMemorySessionStore();
    await store.save({
      accountId: 'account-cdp',
      cookiesJson: '[{"name":"li_at","value":"cookie","domain":".linkedin.com","path":"/"}]',
      userAgent: 'test-agent',
      capturedAt: 1735689600000
    });

    const originalEnv = await fs.readFile(workspaceEnvPath, 'utf8').catch(() => null);
    const previousCwd = process.cwd();

    try {
      process.chdir(path.resolve(import.meta.dirname, '../..'));
      await fs.writeFile(workspaceEnvPath, 'CHROME_CDP_URL=http://127.0.0.1:9222\nUSER_DATA_DIR=C:/ChromeProfile\n', 'utf8');

      const provider = await createBrowserSyncProvider(
        { provider: 'linkedin-browser', accountId: 'account-cdp' },
        { enableRealBrowserSync: true, sessionStore: store }
      );

      expect(provider.constructor.name).toBe('CdpMessagingProvider');
    } finally {
      process.chdir(previousCwd);
      if (originalEnv === null) {
        await fs.rm(workspaceEnvPath, { force: true });
      } else {
        await fs.writeFile(workspaceEnvPath, originalEnv, 'utf8');
      }
    }
  });

  it('uses a persistent profile when USER_DATA_DIR is configured without CDP', async () => {
    const originalEnv = await fs.readFile(workspaceEnvPath, 'utf8').catch(() => null);
    const previousCwd = process.cwd();
    const fakeProfileRoot = path.resolve(import.meta.dirname, `./tmp-profile-${Date.now()}-${Math.random().toString(16).slice(2)}`);

    try {
      process.chdir(path.resolve(import.meta.dirname, '../..'));
      await fs.mkdir(path.join(fakeProfileRoot, 'Network'), { recursive: true });
      await fs.writeFile(path.join(fakeProfileRoot, 'Network', 'Cookies'), '', 'utf8');
      await fs.writeFile(workspaceEnvPath, `USER_DATA_DIR=${fakeProfileRoot.replace(/\\/g, '/')}\n`, 'utf8');

      const provider = await createBrowserSyncProvider(
        { provider: 'linkedin-browser', accountId: 'account-profile' },
        { enableRealBrowserSync: true, sessionStore: new InMemorySessionStore() }
      );

      expect(provider.constructor.name).toBe('PersistentProfileMessagingProvider');
    } finally {
      process.chdir(previousCwd);
      await fs.rm(fakeProfileRoot, { recursive: true, force: true });
      if (originalEnv === null) {
        await fs.rm(workspaceEnvPath, { force: true });
      } else {
        await fs.writeFile(workspaceEnvPath, originalEnv, 'utf8');
      }
    }
  });

  it('falls back to a saved cookie session when no CDP or profile is configured', async () => {
    const store = new InMemorySessionStore();
    await store.save({
      accountId: 'account-session',
      cookiesJson: '[{"name":"li_at","value":"cookie","domain":".linkedin.com","path":"/"}]',
      userAgent: 'test-agent',
      capturedAt: 1735689600000
    });

    const originalEnv = await fs.readFile(workspaceEnvPath, 'utf8').catch(() => null);
    const previousCwd = process.cwd();

    try {
      process.chdir(path.resolve(import.meta.dirname, '../..'));
      await fs.rm(workspaceEnvPath, { force: true });

      const provider = await createBrowserSyncProvider(
        { provider: 'linkedin-browser', accountId: 'account-session' },
        { enableRealBrowserSync: true, sessionStore: store }
      );

      expect(provider.constructor.name).toBe('PlaywrightMessagingProvider');
    } finally {
      process.chdir(previousCwd);
      if (originalEnv !== null) {
        await fs.writeFile(workspaceEnvPath, originalEnv, 'utf8');
      }
    }
  });

  it('exposes send support for the CDP-backed provider', async () => {
    const store = new InMemorySessionStore();
    await store.save({
      accountId: 'account-cdp-send',
      cookiesJson: '[{"name":"li_at","value":"cookie","domain":".linkedin.com","path":"/"}]',
      userAgent: 'test-agent',
      capturedAt: 1735689600000
    });

    const originalEnv = await fs.readFile(workspaceEnvPath, 'utf8').catch(() => null);
    const previousCwd = process.cwd();

    try {
      process.chdir(path.resolve(import.meta.dirname, '../..'));
      await fs.writeFile(workspaceEnvPath, 'CHROME_CDP_URL=http://127.0.0.1:9222\n', 'utf8');

      const provider = await createBrowserSyncProvider(
        { provider: 'linkedin-browser', accountId: 'account-cdp-send' },
        { enableRealBrowserSync: true, sessionStore: store }
      );

      expect(typeof provider.sendMessage).toBe('function');
    } finally {
      process.chdir(previousCwd);
      if (originalEnv === null) {
        await fs.rm(workspaceEnvPath, { force: true });
      } else {
        await fs.writeFile(workspaceEnvPath, originalEnv, 'utf8');
      }
    }
  });

  it('exposes send support for the persistent-profile provider', async () => {
    const originalEnv = await fs.readFile(workspaceEnvPath, 'utf8').catch(() => null);
    const previousCwd = process.cwd();
    const fakeProfileRoot = path.resolve(import.meta.dirname, `./tmp-profile-send-${Date.now()}-${Math.random().toString(16).slice(2)}`);

    try {
      process.chdir(path.resolve(import.meta.dirname, '../..'));
      await fs.mkdir(path.join(fakeProfileRoot, 'Network'), { recursive: true });
      await fs.writeFile(path.join(fakeProfileRoot, 'Network', 'Cookies'), '', 'utf8');
      await fs.writeFile(workspaceEnvPath, `USER_DATA_DIR=${fakeProfileRoot.replace(/\\/g, '/')}\n`, 'utf8');

      const provider = await createBrowserSyncProvider(
        { provider: 'linkedin-browser', accountId: 'account-profile-send' },
        { enableRealBrowserSync: true, sessionStore: new InMemorySessionStore() }
      );

      expect(typeof provider.sendMessage).toBe('function');
    } finally {
      process.chdir(previousCwd);
      await fs.rm(fakeProfileRoot, { recursive: true, force: true });
      if (originalEnv === null) {
        await fs.rm(workspaceEnvPath, { force: true });
      } else {
        await fs.writeFile(workspaceEnvPath, originalEnv, 'utf8');
      }
    }
  });

  it('exposes send support for the saved-session provider fallback', async () => {
    const store = new InMemorySessionStore();
    await store.save({
      accountId: 'account-session-send',
      cookiesJson: '[{"name":"li_at","value":"cookie","domain":".linkedin.com","path":"/"}]',
      userAgent: 'test-agent',
      capturedAt: 1735689600000
    });

    const originalEnv = await fs.readFile(workspaceEnvPath, 'utf8').catch(() => null);
    const previousCwd = process.cwd();

    try {
      process.chdir(path.resolve(import.meta.dirname, '../..'));
      await fs.rm(workspaceEnvPath, { force: true });

      const provider = await createBrowserSyncProvider(
        { provider: 'linkedin-browser', accountId: 'account-session-send' },
        { enableRealBrowserSync: true, sessionStore: store }
      );

      expect(typeof provider.sendMessage).toBe('function');
    } finally {
      process.chdir(previousCwd);
      if (originalEnv !== null) {
        await fs.writeFile(workspaceEnvPath, originalEnv, 'utf8');
      }
    }
  });

  it('returns a deterministic import summary for fake thread sync', async () => {
    await expect(runFakeImportThreads({ provider: 'fake-linkedin', accountId: 'local-account' })).resolves.toMatchObject({
      provider: 'fake-linkedin',
      accountId: 'local-account',
      itemsScanned: 1,
      itemsImported: 1,
      threadIds: ['thread-import-001']
    });
  });

  it('falls back to the fake import path when real browser sync is disabled', async () => {
    await expect(
      runImportThreads(
        { provider: 'fake-linkedin', accountId: 'local-account' },
        { enableRealBrowserSync: false }
      )
    ).resolves.toMatchObject({
      itemsScanned: 1,
      itemsImported: 1,
      threadIds: ['thread-import-001']
    });
  });

  it('rejects browser send when real send is disabled', async () => {
    await expect(
      sendBrowserMessage(
        {
          draftId: 'draft-001',
          conversationId: 'conversation-001',
          accountId: 'local-account',
          provider: 'linkedin-browser',
          messageText: 'Approved message'
        },
        {
          enableRealBrowserSync: true,
          enableRealSend: false,
          sessionStore: new InMemorySessionStore()
        }
      )
    ).rejects.toThrow(/real send is disabled/i);
  });

  it('returns a deterministic fake send result when real send is enabled for the fake provider', async () => {
    await expect(
      sendBrowserMessage(
        {
          draftId: 'draft-003',
          conversationId: 'conversation-003',
          accountId: 'local-account',
          provider: 'fake-linkedin',
          messageText: 'Approved fake send'
        },
        {
          enableRealBrowserSync: false,
          enableRealSend: true
        }
      )
    ).resolves.toMatchObject({
      provider: 'fake-linkedin',
      accountId: 'local-account',
      draftId: 'draft-003',
      conversationId: 'conversation-003'
    });
  });
});