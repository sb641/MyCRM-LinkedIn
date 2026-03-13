import { createLogger, getFeatureFlags } from '@mycrm/core';
import { createDb, createJobRepository } from '@mycrm/db';

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
      await repository.markJobSucceeded(job.id);
      return { status: 'processed' as const, processedJobId: job.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown worker error';
      await repository.markJobFailed(job.id, message);
      return { status: 'failed' as const, processedJobId: job.id };
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
