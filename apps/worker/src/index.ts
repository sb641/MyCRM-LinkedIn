import { createLogger, getFeatureFlags } from '@mycrm/core';
import { createDb, createJobRepository, createSyncRunRepository } from '@mycrm/db';
import { runFakeImportThreads } from '@mycrm/automation';

const logger = createLogger('worker');

export async function runWorkerCycle(databaseUrl?: string) {
  const { db, sqlite } = await createDb(databaseUrl);

  try {
    const repository = createJobRepository(db, sqlite);
    const job = await repository.claimNextJob();

    if (!job) {
      return { status: 'idle' as const, processedJobId: null };
    }

    try {
      logger.info({ jobId: job.id, type: job.type }, 'worker processing job');

      if (job.type === 'import_threads') {
        const payload = JSON.parse(job.payload) as Record<string, unknown>;
        const syncRunRepository = createSyncRunRepository(db, sqlite);
        const syncRunId = await syncRunRepository.createSyncRun({
          provider: typeof payload.provider === 'string' ? payload.provider : 'fake-linkedin'
        });

        try {
          const result = await runFakeImportThreads(payload);
          await syncRunRepository.markSyncRunFinished({
            syncRunId,
            status: 'succeeded',
            itemsScanned: result.itemsScanned,
            itemsImported: result.itemsImported
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown import error';
          await syncRunRepository.markSyncRunFinished({
            syncRunId,
            status: 'failed',
            itemsScanned: 0,
            itemsImported: 0,
            error: message
          });
          throw error;
        }
      }

      await repository.markJobSucceeded(job.id);
      return { status: 'processed' as const, processedJobId: job.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown worker error';
      await repository.markJobFailed(job.id, message);
      const jobs = await repository.listJobs();
      const updatedJob = jobs.find((item) => item.id === job.id);

      return {
        status: updatedJob?.status === 'retry_scheduled' ? ('retry_scheduled' as const) : ('failed' as const),
        processedJobId: job.id
      };
    }
  } finally {
    await sqlite.close();
  }
}

export function startWorker() {
  const flags = getFeatureFlags();
  logger.info({ flags }, 'worker booted');
  return {
    status: 'idle' as const,
    flags
  };
}

if (process.env.NODE_ENV !== 'test') {
  startWorker();
}
