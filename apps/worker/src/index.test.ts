import path from 'node:path';
import { vi } from 'vitest';

import { startWorker } from './index';
import { createDb, createJobRepository, createSyncRunRepository } from '@mycrm/db';
import { runMigrations } from '../../../packages/db/src/migrate';
import { runWorkerCycle } from './index';

describe('worker bootstrap', () => {
  it('starts in idle mode', () => {
    expect(startWorker()).toMatchObject({ status: 'idle' });
  });

  it('claims and completes a queued job', async () => {
    const databaseUrl = `file:${path.resolve(
      import.meta.dirname,
      `./worker-phase7-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
    )}`;

    await runMigrations(databaseUrl);

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
    const databaseUrl = `file:${path.resolve(
      import.meta.dirname,
      `./worker-phase7-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
    )}`;

    await runMigrations(databaseUrl);

    const setupConnection = await createDb(databaseUrl);
    const dateNowSpy = vi.spyOn(Date, 'now');

    try {
      const repository = createJobRepository(setupConnection.db, setupConnection.sqlite);
      const retryPolicy = repository.getRetryPolicy();
      const baseNow = Date.now();
      const enqueued = await repository.enqueueJob('generate_draft', { contactId: 'contact-001' });

      await setupConnection.sqlite.close();

      dateNowSpy.mockReturnValue(baseNow);
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

    await runMigrations(databaseUrl);

    const setupConnection = await createDb(databaseUrl);

    try {
      const repository = createJobRepository(setupConnection.db, setupConnection.sqlite);
      const enqueued = await repository.enqueueJob('import_threads', {
        provider: 'fake-linkedin',
        accountId: 'local-account'
      });

      await setupConnection.sqlite.close();

      const result = await runWorkerCycle(databaseUrl);
      expect(result.status).toBe('processed');

      const verificationConnection = await createDb(databaseUrl);
      try {
        const jobs = await createJobRepository(verificationConnection.db, verificationConnection.sqlite).listJobs();
        const syncRuns = await createSyncRunRepository(verificationConnection.db, verificationConnection.sqlite).listSyncRuns();
        const processedJob = jobs.find((job) => job.id === enqueued.jobId);

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
});
