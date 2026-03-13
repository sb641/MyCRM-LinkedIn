import path from 'node:path';

import { startWorker } from './index';
import { createDb, createJobRepository } from '@mycrm/db';
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
});
