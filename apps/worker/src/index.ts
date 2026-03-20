import { createLogger, getFeatureFlags } from '@mycrm/core';
import { createJobRepository, createMutationRepository, createSyncRunRepository } from '@mycrm/db';
import { getDb } from '../../../packages/db/src/server/get-db';
import { runImportThreads, sendBrowserMessage } from '@mycrm/automation';
import { createFileSessionStore } from '../../../packages/automation/src/session-store';

const logger = createLogger('worker');
const WORKER_POLL_INTERVAL_MS = 1500;
let hasLoggedResolvedDatabase = false;

async function openWorkerDb(databaseUrl?: string) {
  const { db, sqlite, resolvedDatabasePath, resolvedDatabaseUrl } = await getDb(databaseUrl);

  if (!hasLoggedResolvedDatabase) {
    logger.info(
      {
        resolvedDatabasePath,
        resolvedDatabaseUrl: resolvedDatabaseUrl.startsWith('file:') ? resolvedDatabaseUrl : '[non-file-database-url]'
      },
      'worker resolved database'
    );
    hasLoggedResolvedDatabase = true;
  }

  return {
    db,
    sqlite,
    resolvedDatabasePath,
    resolvedDatabaseUrl
  };
}

async function markSentDraft(databaseUrl: string | undefined, draftId: string, sentAt: number) {
  const { db: mutationDb, sqlite: mutationSqlite } = await openWorkerDb(databaseUrl);
  const repository = createMutationRepository(mutationDb, mutationSqlite);
  return await repository.markDraftSent(draftId, sentAt);
}

async function countUnsuppressedImportedThreads(
  databaseUrl: string | undefined,
  threadIds: string[] | undefined
) {
  if (!threadIds || threadIds.length === 0) {
    return {
      importedCount: 0,
      matchedConversationCount: 0
    };
  }

  const { db: mutationDb, sqlite: mutationSqlite } = await openWorkerDb(databaseUrl);
  const repository = createMutationRepository(mutationDb, mutationSqlite);
  let importedCount = 0;
  let matchedConversationCount = 0;

  for (const threadId of threadIds) {
    const [contact] = await mutationSqlite.all<{ linkedin_profile_id: string | null }>(
      `
        SELECT c.linkedin_profile_id
        FROM conversations conv
        INNER JOIN contacts c ON c.id = conv.contact_id
        WHERE conv.linkedin_thread_id = '${threadId.replace(/'/g, "''")}'
        LIMIT 1
      `
    );

    if (!contact) {
      continue;
    }

    matchedConversationCount += 1;

    if (!contact?.linkedin_profile_id) {
      importedCount += 1;
      continue;
    }

    const suppressed = await repository.isLinkedinProfileSuppressed(contact.linkedin_profile_id);
    if (!suppressed) {
      importedCount += 1;
    }
  }

  return {
    importedCount,
    matchedConversationCount
  };
}

export const __testables = {
  markSentDraft,
  countUnsuppressedImportedThreads
};

export async function runWorkerCycle(databaseUrl?: string) {
  const resolvedDatabaseUrl = databaseUrl;
  const { db, sqlite } = await openWorkerDb(resolvedDatabaseUrl);

  try {
    const repository = createJobRepository(db, sqlite);
    const job = await repository.claimNextJob();

    if (!job) {
      return { status: 'idle' as const, processedJobId: null };
    }

    logger.info(
      {
        jobId: job.id,
        type: job.type,
        attemptCount: job.attemptCount
      },
      'worker claimed job'
    );

    try {
      logger.info({ jobId: job.id, type: job.type }, 'worker processing job');

      if (job.type === 'import_threads') {
        const payload = JSON.parse(job.payload) as Record<string, unknown>;
        const syncRunRepository = createSyncRunRepository(db, sqlite);
        const flags = getFeatureFlags();
        const syncRunId = await syncRunRepository.createSyncRun({
          provider: typeof payload.provider === 'string' ? payload.provider : 'fake-linkedin'
        });

        logger.info(
          {
            jobId: job.id,
            syncRunId,
            accountId: typeof payload.accountId === 'string' ? payload.accountId : null,
            provider: typeof payload.provider === 'string' ? payload.provider : 'fake-linkedin'
          },
          'worker started import sync run'
        );

        try {
          const result = await runImportThreads(payload, {
            enableRealBrowserSync: flags.ENABLE_REAL_BROWSER_SYNC,
            sessionStore: createFileSessionStore(),
            db,
            sqlite
          });
          const suppressionAwareCounts = await countUnsuppressedImportedThreads(
            resolvedDatabaseUrl,
            'threadIds' in result && Array.isArray(result.threadIds) ? result.threadIds : undefined
          );
          const itemsImported =
            suppressionAwareCounts.matchedConversationCount > 0
              ? suppressionAwareCounts.importedCount
              : result.itemsImported;
          await syncRunRepository.markSyncRunFinished({
            syncRunId,
            status: 'succeeded',
            itemsScanned: result.itemsScanned,
            itemsImported
          });
          logger.info(
            {
              jobId: job.id,
              syncRunId,
              itemsScanned: result.itemsScanned,
              itemsImported,
              messagesImported: 'messagesImported' in result ? result.messagesImported ?? 0 : 0
            },
            'worker finished import sync run'
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown import error';
          await syncRunRepository.markSyncRunFinished({
            syncRunId,
            status: 'failed',
            itemsScanned: 0,
            itemsImported: 0,
            error: message
          });
          logger.error({ jobId: job.id, syncRunId, error: message }, 'worker import sync run failed');
          throw error;
        }
      }

      if (job.type === 'send_message') {
        const payload = JSON.parse(job.payload) as Record<string, unknown>;
        const flags = getFeatureFlags();
        const draftId = typeof payload.draftId === 'string' ? payload.draftId : null;

        if (draftId) {
          const { db: mutationDb, sqlite: mutationSqlite } = await openWorkerDb(resolvedDatabaseUrl);
          const mutationRepository = createMutationRepository(mutationDb, mutationSqlite);
          const draft = await mutationRepository.findDraftForSend(draftId);

          if (draft?.sendStatus === 'sent') {
            await mutationRepository.markDraftSent(draftId, draft.sentAt ?? Date.now());
            await repository.markJobSucceeded(job.id);
            return { status: 'processed' as const, processedJobId: job.id };
          }
        }

        try {
          const result = await sendBrowserMessage(payload, {
            enableRealBrowserSync: flags.ENABLE_REAL_BROWSER_SYNC,
            enableRealSend: flags.ENABLE_REAL_SEND,
            sessionStore: createFileSessionStore()
          });

          logger.info(
            {
              jobId: job.id,
              draftId: result.draftId,
              sentAt: result.sentAt
            },
            'worker browser send completed'
          );

          const updated = await markSentDraft(resolvedDatabaseUrl, result.draftId, result.sentAt);

          if (updated === 0) {
            throw new Error(`Sent draft could not be updated: ${result.draftId}`);
          }
        } catch (error) {
          const { db: mutationDb, sqlite: mutationSqlite } = await openWorkerDb(resolvedDatabaseUrl);
          const repository = createMutationRepository(mutationDb, mutationSqlite);
          if (draftId) {
            const draft = await repository.findDraftForSend(draftId);

            if (draft?.sendStatus !== 'sent') {
              await repository.markDraftSendFailed(draftId);
            }
          }

          throw error;
        }
      }

      await repository.markJobSucceeded(job.id);
      return { status: 'processed' as const, processedJobId: job.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown worker error';
      logger.error({ jobId: job.id, type: job.type, error: message }, 'worker job failed');
      await repository.markJobFailed(job.id, message);
      const jobs = await repository.listJobs();
      const updatedJob = jobs.find((item) => item.id === job.id);

      return {
        status: updatedJob?.status === 'retry_scheduled' ? ('retry_scheduled' as const) : ('failed' as const),
        processedJobId: job.id
      };
    }
  } finally {
  }
}

export function startWorker() {
  const flags = getFeatureFlags();
  let isRunningCycle = false;

  const runNextCycle = async () => {
    if (isRunningCycle) {
      return;
    }

    isRunningCycle = true;

    try {
      const result = await runWorkerCycle();

      if (result.status !== 'idle') {
        logger.info(result, 'worker cycle finished');
      }
    } catch (error) {
      logger.error({ error }, 'worker cycle crashed');
    } finally {
      isRunningCycle = false;
    }
  };

  void openWorkerDb().then(
    () => {
      return;
    },
    (error) => {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'worker failed to resolve database on boot'
      );
    }
  );

  logger.info({ flags }, 'worker booted');
  void runNextCycle();
  setInterval(() => {
    void runNextCycle();
  }, WORKER_POLL_INTERVAL_MS);


  return {
    status: 'idle' as const,
    flags,
    pollIntervalMs: WORKER_POLL_INTERVAL_MS
  };
}

if (process.env.NODE_ENV !== 'test') {
  startWorker();
}
