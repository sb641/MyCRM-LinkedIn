import { createLogger, getFeatureFlags } from '@mycrm/core';
import { createDb, createJobRepository, createMutationRepository, createSyncRunRepository } from '@mycrm/db';
import { createFileSessionStore, runImportThreads, sendBrowserMessage } from '@mycrm/automation';

const logger = createLogger('worker');

async function markSentDraft(databaseUrl: string | undefined, draftId: string, sentAt: number) {
  const { db: mutationDb, sqlite: mutationSqlite } = await createDb(databaseUrl);

  try {
    const repository = createMutationRepository(mutationDb, mutationSqlite);
    return await repository.markDraftSent(draftId, sentAt);
  } finally {
    await mutationSqlite.close();
  }
}

export const __testables = {
  markSentDraft
};

export async function runWorkerCycle(databaseUrl?: string) {
  const resolvedDatabaseUrl = databaseUrl;
  const { db, sqlite } = await createDb(resolvedDatabaseUrl);

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
        const flags = getFeatureFlags();
        const syncRunId = await syncRunRepository.createSyncRun({
          provider: typeof payload.provider === 'string' ? payload.provider : 'fake-linkedin'
        });

        try {
          const result = await runImportThreads(payload, {
            enableRealBrowserSync: flags.ENABLE_REAL_BROWSER_SYNC,
            sessionStore: createFileSessionStore()
          });
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

      if (job.type === 'send_message') {
        const payload = JSON.parse(job.payload) as Record<string, unknown>;
        const flags = getFeatureFlags();
        const draftId = typeof payload.draftId === 'string' ? payload.draftId : null;

        if (draftId) {
          const { db: mutationDb, sqlite: mutationSqlite } = await createDb(resolvedDatabaseUrl);
          try {
            const repository = createMutationRepository(mutationDb, mutationSqlite);
            const draft = await repository.findDraftForSend(draftId);

            if (draft?.sendStatus === 'sent') {
              await repository.markDraftSent(draftId, draft.sentAt ?? Date.now());
              await repository.markJobSucceeded(job.id);
              return { status: 'processed' as const, processedJobId: job.id };
            }
          } finally {
            await mutationSqlite.close();
          }
        }

        try {
          const result = await sendBrowserMessage(payload, {
            enableRealBrowserSync: flags.ENABLE_REAL_BROWSER_SYNC,
            enableRealSend: flags.ENABLE_REAL_SEND,
            sessionStore: createFileSessionStore()
          });

          const updated = await markSentDraft(resolvedDatabaseUrl, result.draftId, result.sentAt);

          if (updated === 0) {
            throw new Error(`Sent draft could not be updated: ${result.draftId}`);
          }
        } catch (error) {
          const { db: mutationDb, sqlite: mutationSqlite } = await createDb(resolvedDatabaseUrl);
          try {
            const repository = createMutationRepository(mutationDb, mutationSqlite);
            if (draftId) {
              const draft = await repository.findDraftForSend(draftId);

              if (draft?.sendStatus !== 'sent') {
                await repository.markDraftSendFailed(draftId);
              }
            }
          } finally {
            await mutationSqlite.close();
          }

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
