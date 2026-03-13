import { describe, expect, it } from 'vitest';

import {
  createBrowserSyncProvider,
  FakeMessagingProvider,
  InMemorySessionStore,
  MockMessagingProvider,
  PlaywrightMessagingProvider,
  parseThreadFixture,
  runImportThreads,
  runFakeImportThreads
} from './index';

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

    await expect(provider.listThreads()).rejects.toThrow(/not implemented yet/i);
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
    await expect(
      createBrowserSyncProvider(
        { provider: 'linkedin-browser', accountId: 'missing-account' },
        { enableRealBrowserSync: true, sessionStore: new InMemorySessionStore() }
      )
    ).rejects.toThrow(/no saved browser session/i);
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
});