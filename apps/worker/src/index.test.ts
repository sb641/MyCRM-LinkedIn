import fs from 'node:fs/promises';
import path from 'node:path';
import { vi } from 'vitest';

import { __testables, startWorker } from './index';
import { createJobRepository, createMutationRepository, createSyncRunRepository } from '@mycrm/db';
import { createNodeDb as createDb } from '../../../packages/db/src/server/node-sqlite';
import { runMigrations } from '../../../packages/db/src/migrate';
import { runWorkerCycle } from './index';
import { buildSeedData } from '../../../packages/db/src/seed-data';
import { accounts, contacts, conversations, drafts, draftVariants, messages, settings, auditLog } from '../../../packages/db/src/schema';

vi.mock('@mycrm/automation', async () => {
  const actual = await vi.importActual<typeof import('@mycrm/automation')>('@mycrm/automation');

  return {
    ...actual,
    sendBrowserMessage: vi.fn(actual.sendBrowserMessage)
  };
});

const automationModule = await import('@mycrm/automation');

async function setupSeededDb(databaseUrl: string) {
  await runMigrations(databaseUrl);
  const { db, sqlite } = await createDb(databaseUrl);
  const seed = buildSeedData();

  try {
    await db.insert(accounts).values(seed.accounts);
    await db.insert(contacts).values(seed.contacts);
    await db.insert(conversations).values(seed.conversations);
    await db.insert(messages).values(seed.messages);
    await db.insert(drafts).values(seed.drafts);
    await db.insert(draftVariants).values(seed.draftVariants);
    await db.insert(settings).values(seed.settings);
    await db.insert(auditLog).values(seed.auditLog);
  } finally {
    await sqlite.close();
  }
}

describe('worker bootstrap', () => {
  it('starts in idle mode', () => {
    expect(startWorker()).toMatchObject({ status: 'idle' });
  });

  it('claims and completes a queued job', async () => {
    const databaseUrl = `file:${path.resolve(
      import.meta.dirname,
      `./worker-phase7-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
    )}`;

    await setupSeededDb(databaseUrl);

    const setupConnection = await createDb(databaseUrl);

    try {
      const repository = createJobRepository(setupConnection.db, setupConnection.sqlite);
      const enqueued = await repository.enqueueJob('generate_draft', { contactId: 'contact-001' });

      expect(enqueued.status).toBe('queued');

      await setupConnection.sqlite.close();

      const result = await runWorkerCycle(databaseUrl);
      expect(result.status).toBe('processed');

      const verificationConnection = await createDb(databaseUrl);
      try {
        const jobs = await createJobRepository(verificationConnection.db, verificationConnection.sqlite).listJobs();
        const processedJob = jobs.find((job) => job.id === enqueued.jobId);

        expect(processedJob?.status).toBe('succeeded');
      } finally {
        await verificationConnection.sqlite.close();
      }
    } finally {
      await setupConnection.sqlite.close().catch(() => undefined);
    }
  });

  it('marks a failed job for retry before terminal failure', async () => {
    const dateNowSpy = vi.spyOn(Date, 'now');
    const baseNow = 1735689600000;
    dateNowSpy.mockReturnValue(baseNow);
    const databaseUrl = `file:${path.resolve(
      import.meta.dirname,
      `./worker-phase7-test-${baseNow}-${Math.random().toString(16).slice(2)}.db`
    )}`;

    await setupSeededDb(databaseUrl);

    const setupConnection = await createDb(databaseUrl);

    try {
      const repository = createJobRepository(setupConnection.db, setupConnection.sqlite);
      const retryPolicy = repository.getRetryPolicy();
      const enqueued = await repository.enqueueJob('generate_draft', { contactId: 'contact-001' });

      await setupConnection.sqlite.close();

      const result = await runWorkerCycle(databaseUrl);

      expect(result.status).toBe('processed');

      const verificationConnection = await createDb(databaseUrl);
      try {
        const verificationRepository = createJobRepository(verificationConnection.db, verificationConnection.sqlite);
        await verificationRepository.markJobFailed(enqueued.jobId, 'temporary failure');

        const jobs = await verificationRepository.listJobs();
        const retriedJob = jobs.find((job) => job.id === enqueued.jobId);

        expect(retriedJob?.status).toBe('retry_scheduled');
        expect(retriedJob?.scheduledFor).toBe(baseNow + retryPolicy.retryDelayMs);
      } finally {
        await verificationConnection.sqlite.close();
      }
    } finally {
      dateNowSpy.mockRestore();
      await setupConnection.sqlite.close().catch(() => undefined);
    }
  });

  it('processes import_threads jobs through the fake automation flow', async () => {
    const databaseUrl = `file:${path.resolve(
      import.meta.dirname,
      `./worker-phase8-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
    )}`;

    await setupSeededDb(databaseUrl);

    const setupConnection = await createDb(databaseUrl);

    try {
      const repository = createJobRepository(setupConnection.db, setupConnection.sqlite);
      const enqueued = await repository.enqueueJob('import_threads', {
        provider: 'fake-linkedin',
        accountId: 'local-account'
      });

      await setupConnection.sqlite.close();

      const result = await runWorkerCycle(databaseUrl);

      const verificationConnection = await createDb(databaseUrl);
      try {
        const jobs = await createJobRepository(verificationConnection.db, verificationConnection.sqlite).listJobs();
        const syncRuns = await createSyncRunRepository(verificationConnection.db, verificationConnection.sqlite).listSyncRuns();
        const processedJob = jobs.find((job) => job.id === enqueued.jobId);
        expect(result.status).toBe('processed');

        expect(processedJob?.status).toBe('succeeded');
        expect(syncRuns[0]).toMatchObject({
          provider: 'fake-linkedin',
          status: 'succeeded',
          itemsScanned: 1,
          itemsImported: 1
        });
      } finally {
        await verificationConnection.sqlite.close();
      }
    } finally {
      await setupConnection.sqlite.close().catch(() => undefined);
    }
  });

  it('falls back to the automation import count when imported threads are not persisted yet', async () => {
    const databaseUrl = `file:${path.resolve(
      import.meta.dirname,
      `./worker-phase8-suppression-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
    )}`;

    await setupSeededDb(databaseUrl);

    const setupConnection = await createDb(databaseUrl);

    try {
      const mutationRepository = createMutationRepository(setupConnection.db, setupConnection.sqlite);
      await mutationRepository.addSyncSuppression({
        contactId: 'contact-001',
        linkedinProfileId: 'linkedin-profile-1',
        reason: 'ignored forever'
      });

      const repository = createJobRepository(setupConnection.db, setupConnection.sqlite);
      await repository.enqueueJob('import_threads', {
        provider: 'fake-linkedin',
        accountId: 'local-account'
      });

      await setupConnection.sqlite.close();

      const result = await runWorkerCycle(databaseUrl);

      const verificationConnection = await createDb(databaseUrl);
      try {
        const syncRuns = await createSyncRunRepository(verificationConnection.db, verificationConnection.sqlite).listSyncRuns();
        const jobs = await createJobRepository(verificationConnection.db, verificationConnection.sqlite).listJobs();
        const processedJob = jobs[0];
        expect(result.status).toBe('processed');

        expect(syncRuns[0]).toMatchObject({
          provider: 'fake-linkedin',
          status: 'succeeded',
          itemsScanned: 1,
          itemsImported: 1
        });
      } finally {
        await verificationConnection.sqlite.close();
      }
    } finally {
      await setupConnection.sqlite.close().catch(() => undefined);
    }
  });

  it('fails import_threads jobs when real browser sync is enabled without a saved session', async () => {
    const databaseUrl = `file:${path.resolve(
      import.meta.dirname,
      `./worker-phase9-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
    )}`;

    await setupSeededDb(databaseUrl);

    const setupConnection = await createDb(databaseUrl);

    try {
      const repository = createJobRepository(setupConnection.db, setupConnection.sqlite);
      const enqueued = await repository.enqueueJob('import_threads', {
        provider: 'linkedin-browser',
        accountId: 'missing-account'
      });

      await setupConnection.sqlite.close();

      const previousFlag = process.env.ENABLE_REAL_BROWSER_SYNC;
      process.env.ENABLE_REAL_BROWSER_SYNC = 'true';

      try {
        const result = await runWorkerCycle(databaseUrl);
        expect(result.status).toBe('retry_scheduled');

        const verificationConnection = await createDb(databaseUrl);
        try {
          const jobs = await createJobRepository(verificationConnection.db, verificationConnection.sqlite).listJobs();
          const syncRuns = await createSyncRunRepository(verificationConnection.db, verificationConnection.sqlite).listSyncRuns();
          const processedJob = jobs.find((job) => job.id === enqueued.jobId);

          expect(processedJob?.status).toBe('retry_scheduled');
          expect(processedJob?.lastError).toMatch(/no saved browser session/i);
          expect(syncRuns[0]).toMatchObject({
            provider: 'linkedin-browser',
            status: 'failed',
            itemsScanned: 0,
            itemsImported: 0
          });
        } finally {
          await verificationConnection.sqlite.close();
        }
      } finally {
        if (previousFlag === undefined) {
          delete process.env.ENABLE_REAL_BROWSER_SYNC;
        } else {
          process.env.ENABLE_REAL_BROWSER_SYNC = previousFlag;
        }
      }
    } finally {
      await setupConnection.sqlite.close().catch(() => undefined);
    }
  });

  it('records a failed sync run when a saved browser session exists but browser execution is not implemented yet', async () => {
    const databaseUrl = `file:${path.resolve(
      import.meta.dirname,
      `./worker-phase9-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
    )}`;
    const sessionRoot = path.resolve(
      process.cwd(),
      `.mycrm/sessions`
    );
    const sessionPath = path.join(sessionRoot, 'local-account.json');

    await setupSeededDb(databaseUrl);
    await fs.mkdir(sessionRoot, { recursive: true });
    await fs.writeFile(
      sessionPath,
      JSON.stringify(
        {
          accountId: 'local-account',
          cookiesJson: '[{"name":"li_at","value":"test"}]',
          userAgent: 'phase9-test-agent',
          capturedAt: 1735689600000
        },
        null,
        2
      ),
      'utf8'
    );

    const setupConnection = await createDb(databaseUrl);

    try {
      const repository = createJobRepository(setupConnection.db, setupConnection.sqlite);
      const enqueued = await repository.enqueueJob('import_threads', {
        provider: 'linkedin-browser',
        accountId: 'local-account'
      });

      await setupConnection.sqlite.close();

      const previousFlag = process.env.ENABLE_REAL_BROWSER_SYNC;
      process.env.ENABLE_REAL_BROWSER_SYNC = 'true';

      try {
        const result = await runWorkerCycle(databaseUrl);
        expect(result.status).toBe('retry_scheduled');

        const verificationConnection = await createDb(databaseUrl);
        try {
          const jobs = await createJobRepository(verificationConnection.db, verificationConnection.sqlite).listJobs();
          const syncRuns = await createSyncRunRepository(verificationConnection.db, verificationConnection.sqlite).listSyncRuns();
          const processedJob = jobs.find((job) => job.id === enqueued.jobId);

          expect(processedJob?.status).toBe('retry_scheduled');
          expect(processedJob?.lastError).toMatch(/not implemented yet/i);
          expect(syncRuns[0]).toMatchObject({
            provider: 'linkedin-browser',
            status: 'failed',
            itemsScanned: 0,
            itemsImported: 0
          });
          expect(syncRuns[0]?.error).toMatch(/not implemented yet/i);
        } finally {
          await verificationConnection.sqlite.close();
        }
      } finally {
        if (previousFlag === undefined) {
          delete process.env.ENABLE_REAL_BROWSER_SYNC;
        } else {
          process.env.ENABLE_REAL_BROWSER_SYNC = previousFlag;
        }
      }
    } finally {
      await fs.rm(sessionPath, { force: true }).catch(() => undefined);
      await setupConnection.sqlite.close().catch(() => undefined);
    }
  });

  it('preserves sent drafts when a duplicate send job fails on retry', async () => {
    const databaseUrl = `file:${path.resolve(
      import.meta.dirname,
      `./worker-phase10-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
    )}`;
    const sessionRoot = path.resolve(process.cwd(), `.mycrm/sessions`);
    const sessionPath = path.join(sessionRoot, 'local-account.json');

    await setupSeededDb(databaseUrl);
    await fs.mkdir(sessionRoot, { recursive: true });
    await fs.writeFile(
      sessionPath,
      JSON.stringify(
        {
          accountId: 'local-account',
          cookiesJson: '[{"name":"li_at","value":"test"}]',
          userAgent: 'phase10-test-agent',
          capturedAt: 1735689600000
        },
        null,
        2
      ),
      'utf8'
    );

    const setupConnection = await createDb(databaseUrl);

    try {
      const repository = createJobRepository(setupConnection.db, setupConnection.sqlite);

      const enqueued = await repository.enqueueJob('send_message', {
        draftId: 'draft-001',
        conversationId: 'conversation-001',
        accountId: 'local-account',
        provider: 'linkedin-browser',
        messageText: 'Approved draft 1'
      });

      await setupConnection.sqlite.close();

      const sendBrowserMessageMock = vi.mocked(automationModule.sendBrowserMessage);
      sendBrowserMessageMock.mockClear();

      const previousBrowserFlag = process.env.ENABLE_REAL_BROWSER_SYNC;
      const previousSendFlag = process.env.ENABLE_REAL_SEND;
      process.env.ENABLE_REAL_BROWSER_SYNC = 'true';
      process.env.ENABLE_REAL_SEND = 'true';

      try {
        const result = await runWorkerCycle(databaseUrl);
        expect(result.status).toBe('retry_scheduled');

        const verificationConnection = await createDb(databaseUrl);
        try {
          const jobs = await createJobRepository(verificationConnection.db, verificationConnection.sqlite).listJobs();
          const processedJob = jobs.find((job) => job.id === enqueued.jobId);
          const draft = await createMutationRepository(
            verificationConnection.db,
            verificationConnection.sqlite
          ).findDraftForSend('draft-001');

          expect(sendBrowserMessageMock).not.toHaveBeenCalled();
          expect(processedJob?.status).toBe('retry_scheduled');
          expect(draft?.sendStatus).toBe('sent');
          expect(draft?.sentAt).not.toBeNull();
        } finally {
          await verificationConnection.sqlite.close();
        }
      } finally {
        if (previousBrowserFlag === undefined) {
          delete process.env.ENABLE_REAL_BROWSER_SYNC;
        } else {
          process.env.ENABLE_REAL_BROWSER_SYNC = previousBrowserFlag;
        }

        if (previousSendFlag === undefined) {
          delete process.env.ENABLE_REAL_SEND;
        } else {
          process.env.ENABLE_REAL_SEND = previousSendFlag;
        }
      }
    } finally {
      await fs.rm(sessionPath, { force: true }).catch(() => undefined);
      await setupConnection.sqlite.close().catch(() => undefined);
    }
  });

  it('marks approved drafts as failed send when browser send execution errors', async () => {
    const databaseUrl = `file:${path.resolve(
      import.meta.dirname,
      `./worker-phase10-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
    )}`;
    const sessionRoot = path.resolve(process.cwd(), `.mycrm/sessions`);
    const sessionPath = path.join(sessionRoot, 'local-account.json');

    await setupSeededDb(databaseUrl);
    await fs.mkdir(sessionRoot, { recursive: true });
    await fs.writeFile(
      sessionPath,
      JSON.stringify(
        {
          accountId: 'local-account',
          cookiesJson: '[{"name":"li_at","value":"test"}]',
          userAgent: 'phase10-test-agent',
          capturedAt: 1735689600000
        },
        null,
        2
      ),
      'utf8'
    );

    const setupConnection = await createDb(databaseUrl);

    try {
      const repository = createJobRepository(setupConnection.db, setupConnection.sqlite);
      const enqueued = await repository.enqueueJob('send_message', {
        draftId: 'draft-003',
        conversationId: 'conversation-003',
        accountId: 'local-account',
        provider: 'linkedin-browser',
        messageText: 'Approved draft 3'
      });

      await setupConnection.sqlite.close();

      const previousBrowserFlag = process.env.ENABLE_REAL_BROWSER_SYNC;
      const previousSendFlag = process.env.ENABLE_REAL_SEND;
      process.env.ENABLE_REAL_BROWSER_SYNC = 'true';
      process.env.ENABLE_REAL_SEND = 'true';

      try {
        const result = await runWorkerCycle(databaseUrl);
        expect(result.status).toBe('retry_scheduled');

        const verificationConnection = await createDb(databaseUrl);
        try {
          const jobs = await createJobRepository(verificationConnection.db, verificationConnection.sqlite).listJobs();
          const processedJob = jobs.find((job) => job.id === enqueued.jobId);
          expect(processedJob?.status).toBe('retry_scheduled');
          expect(processedJob?.lastError).toMatch(/not implemented yet/i);
        } finally {
          await verificationConnection.sqlite.close();
        }
      } finally {
        if (previousBrowserFlag === undefined) {
          delete process.env.ENABLE_REAL_BROWSER_SYNC;
        } else {
          process.env.ENABLE_REAL_BROWSER_SYNC = previousBrowserFlag;
        }

        if (previousSendFlag === undefined) {
          delete process.env.ENABLE_REAL_SEND;
        } else {
          process.env.ENABLE_REAL_SEND = previousSendFlag;
        }
      }
    } finally {
      await fs.rm(sessionPath, { force: true }).catch(() => undefined);
      await setupConnection.sqlite.close().catch(() => undefined);
    }
  });

  it('marks approved drafts as sent and records draft audit when fake send succeeds', async () => {
    const sendBrowserMessageMock = vi.mocked(automationModule.sendBrowserMessage);
    sendBrowserMessageMock.mockClear();
    sendBrowserMessageMock.mockResolvedValueOnce({
      provider: 'fake-linkedin',
      accountId: 'local-account',
      draftId: 'draft-003',
      conversationId: 'conversation-003',
      sentAt: 1735689600000
    });

    const databaseUrl = `file:${path.resolve(
      import.meta.dirname,
      `./worker-phase10-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
    )}`;

    await setupSeededDb(databaseUrl);

    const setupConnection = await createDb(databaseUrl);

    try {
      const repository = createJobRepository(setupConnection.db, setupConnection.sqlite);
      const enqueued = await repository.enqueueJob('send_message', {
        draftId: 'draft-003',
        conversationId: 'conversation-003',
        accountId: 'local-account',
        provider: 'fake-linkedin',
        messageText: 'Approved draft 3'
      });

      await setupConnection.sqlite.close();

      const previousSendFlag = process.env.ENABLE_REAL_SEND;
      process.env.ENABLE_REAL_SEND = 'true';

      try {
        const result = await runWorkerCycle(databaseUrl);
        expect(result.status).toBe('processed');
        expect(result.processedJobId).toBe(enqueued.jobId);
        expect(sendBrowserMessageMock).toHaveBeenCalledTimes(1);
        expect(sendBrowserMessageMock).toHaveBeenCalledWith(
          expect.objectContaining({
            draftId: 'draft-003',
            conversationId: 'conversation-003',
            provider: 'fake-linkedin',
            messageText: 'Approved draft 3'
          }),
          expect.any(Object)
        );
        await expect(sendBrowserMessageMock.mock.results[0]?.value).resolves.toMatchObject({
          draftId: 'draft-003'
        });
        await new Promise((resolve) => setTimeout(resolve, 0));

        const verificationConnection = await createDb(databaseUrl);
        try {
          const jobs = await createJobRepository(verificationConnection.db, verificationConnection.sqlite).listJobs();
          const processedJob = jobs.find((job) => job.id === result.processedJobId);
          const auditEntries = await verificationConnection.sqlite.all<{ action: string; payload: string }>(`
            SELECT action, payload
            FROM audit_log
            WHERE entity_type = 'draft'
              AND entity_id = 'draft-003'
            ORDER BY created_at ASC
          `);

          expect(processedJob?.status).toBe('succeeded');
          expect(auditEntries.length).toBeGreaterThan(0);
        } finally {
          await verificationConnection.sqlite.close();
        }
      } finally {
        if (previousSendFlag === undefined) {
          delete process.env.ENABLE_REAL_SEND;
        } else {
          process.env.ENABLE_REAL_SEND = previousSendFlag;
        }
      }
    } finally {
      await setupConnection.sqlite.close().catch(() => undefined);
    }
  });

  it('persists markDraftSent for a seeded approved draft', async () => {
    const databaseUrl = `file:${path.resolve(
      import.meta.dirname,
      `./worker-phase10-mutation-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
    )}`;

    await setupSeededDb(databaseUrl);

    const connection = await createDb(databaseUrl);

    try {
      const repository = createMutationRepository(connection.db, connection.sqlite);
      const updated = await repository.markDraftSent('draft-003', 1735689600000);

      expect(updated).toBe(1);
    } finally {
      await connection.sqlite.close().catch(() => undefined);
    }

    const verificationConnection = await createDb(databaseUrl);

    try {
      const [draft] = await verificationConnection.sqlite.all<{
        sendStatus: string;
        sentAt: number | null;
      }>(`
        SELECT
          send_status AS sendStatus,
          sent_at AS sentAt
        FROM drafts
        WHERE id = 'draft-003'
        LIMIT 1
      `);
      const auditEntries = await verificationConnection.sqlite.all<{ action: string }>(`
        SELECT action
        FROM audit_log
        WHERE entity_type = 'draft'
          AND entity_id = 'draft-003'
        ORDER BY created_at ASC
      `);

      expect(draft?.sendStatus).toBe('sent');
      expect(draft?.sentAt).toBe(1735689600000);
      expect(auditEntries.some((entry) => entry.action === 'draft.sent')).toBe(true);
    } finally {
      await verificationConnection.sqlite.close();
    }
  });

  it('persists markSentDraft through the worker helper seam', async () => {
    const databaseUrl = `file:${path.resolve(
      import.meta.dirname,
      `./worker-phase10-helper-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
    )}`;

    await setupSeededDb(databaseUrl);

    const updated = await __testables.markSentDraft(databaseUrl, 'draft-003', 1735689600000);
    expect(updated).toBe(1);

    const verificationConnection = await createDb(databaseUrl);

    try {
      const [draft] = await verificationConnection.sqlite.all<{
        sendStatus: string;
        sentAt: number | null;
      }>(`
        SELECT
          send_status AS sendStatus,
          sent_at AS sentAt
        FROM drafts
        WHERE id = 'draft-003'
        LIMIT 1
      `);

      expect(draft?.sendStatus).toBe('sent');
      expect(draft?.sentAt).toBe(1735689600000);
    } finally {
      await verificationConnection.sqlite.close();
    }
  });
});
