import {
  jobWithAuditSchema,
  enqueueJobInputSchema,
  enqueueJobResultSchema,
  jobDtoSchema,
  type JobWithAuditDto,
  linkedinSyncReadinessSchema,
  manualSyncRequestSchema,
  syncRunDtoSchema,
  AppError,
  getEnv
} from '@mycrm/core';
import { createJobRepository, createSyncRunRepository, getDb } from '@mycrm/db/server';
import { getBrowserSession } from '@/lib/services/browser-session-service';

type BrowserCookie = {
  name?: string;
  value?: string;
  domain?: string;
};

function hasUsableSavedSession(cookiesJson: string | null | undefined) {
  if (!cookiesJson?.trim()) {
    return false;
  }

  try {
    const parsed = JSON.parse(cookiesJson) as BrowserCookie[];
    if (!Array.isArray(parsed)) {
      return false;
    }

    return parsed.some(
      (cookie) =>
        typeof cookie?.name === 'string' &&
        cookie.name.length > 0 &&
        cookie.name !== 'legacy_profile_imported' &&
        typeof cookie.value === 'string' &&
        cookie.value.length > 0 &&
        (typeof cookie.domain !== 'string' || cookie.domain.includes('linkedin.com'))
    );
  } catch {
    return false;
  }
}

export async function listJobs(databaseUrl?: string) {
  const { db, sqlite } = await getDb(databaseUrl);

  try {
    const repository = createJobRepository(db, sqlite);
    const jobs = await repository.listJobs();
    return jobDtoSchema.array().parse(jobs);
  } finally {
  }
}

export async function listJobsWithAudit(databaseUrl?: string) {
  const { db, sqlite } = await getDb(databaseUrl);

  try {
    const repository = createJobRepository(db, sqlite);
    const jobs = await repository.listJobs();
    const jobsWithAudit = await Promise.all(
      jobs.map(async (job: Awaited<ReturnType<typeof repository.listJobs>>[number]) => ({
        job,
        auditEntries: await repository.listJobAuditEntries(job.id)
      }))
    );

    return jobWithAuditSchema.array().parse(jobsWithAudit);
  } finally {
  }
}

export async function enqueueJob(input: unknown, databaseUrl?: string) {
  const parsed = enqueueJobInputSchema.parse(input);
  const { db, sqlite } = await getDb(databaseUrl);

  try {
    const repository = createJobRepository(db, sqlite);
    const result = await repository.enqueueJob(parsed.type, parsed.payload, parsed.scheduledFor ?? null);
    return enqueueJobResultSchema.parse(result);
  } finally {
  }
}

export async function enqueueJobWithVerification(input: unknown, databaseUrl?: string) {
  const parsed = enqueueJobInputSchema.parse(input);
  const { db, sqlite, resolvedDatabasePath, resolvedDatabaseUrl } = await getDb(databaseUrl);

  try {
    const repository = createJobRepository(db, sqlite);
    const result = enqueueJobResultSchema.parse(
      await repository.enqueueJob(parsed.type, parsed.payload, parsed.scheduledFor ?? null)
    );
    const jobs = await repository.listJobs();
    const verifiedJob = jobs.find((job) => job.id === result.jobId) ?? null;

    return {
      ...result,
      verifiedJob: verifiedJob ? jobDtoSchema.parse(verifiedJob) : null,
      databaseUrl: databaseUrl ?? null,
      resolvedDatabaseUrl,
      resolvedDatabasePath
    };
  } finally {
  }
}

export async function listSyncRuns(databaseUrl?: string, limit?: number) {
  const { db, sqlite } = await getDb(databaseUrl);

  try {
    const repository = createSyncRunRepository(db, sqlite);
    const syncRuns = await repository.listSyncRuns(limit);
    return syncRunDtoSchema.array().parse(syncRuns);
  } finally {
  }
}

export async function enqueueManualBrowserSync(input: unknown, databaseUrl?: string) {
  const parsed = manualSyncRequestSchema.parse(input);

  await assertManualBrowserSyncReady(parsed);

  return enqueueJob(
    {
      type: 'import_threads',
      payload: {
        provider: parsed.provider,
        accountId: parsed.accountId
      }
    },
    databaseUrl
  );
}

export async function enqueueManualBrowserSyncWithVerification(input: unknown, databaseUrl?: string) {
  const parsed = manualSyncRequestSchema.parse(input);

  await assertManualBrowserSyncReady(parsed);

  return enqueueJobWithVerification(
    {
      type: 'import_threads',
      payload: {
        provider: parsed.provider,
        accountId: parsed.accountId
      }
    },
    databaseUrl
  );
}

export async function listImportThreadJobs(databaseUrl?: string): Promise<JobWithAuditDto[]> {
  const jobs = await listJobsWithAudit(databaseUrl);
  return jobs.filter((entry) => entry.job.type === 'import_threads');
}

export async function getManualBrowserSyncReadiness(accountId: string) {
  const env = getEnv();
  const savedSession = await getBrowserSession(accountId);
  const hasSavedSession = hasUsableSavedSession(savedSession?.cookiesJson);
  const hasCdpUrl = Boolean(env.CHROME_CDP_URL?.trim());
  const hasUserDataDir = Boolean(env.USER_DATA_DIR?.trim());

  const checks = {
    enableRealBrowserSync: env.ENABLE_REAL_BROWSER_SYNC,
    hasCdpUrl,
    hasUserDataDir,
    hasSavedSession
  };

  if (!env.ENABLE_REAL_BROWSER_SYNC) {
    return linkedinSyncReadinessSchema.parse({
      accountId,
      ready: false,
      reason: 'feature_disabled',
      message: 'LinkedIn browser sync is disabled. Set ENABLE_REAL_BROWSER_SYNC=true before starting a manual sync.',
      checks
    });
  }

  if (hasCdpUrl) {
    return linkedinSyncReadinessSchema.parse({
      accountId,
      ready: true,
      reason: 'cdp_configured',
      message: 'Chrome CDP is configured. Sync can reuse an authenticated Chrome session.',
      checks
    });
  }

  if (hasUserDataDir) {
    return linkedinSyncReadinessSchema.parse({
      accountId,
      ready: true,
      reason: 'profile_configured',
      message: 'Chrome user profile is configured. Sync can reuse a local browser profile.',
      checks
    });
  }

  if (hasSavedSession) {
    return linkedinSyncReadinessSchema.parse({
      accountId,
      ready: true,
      reason: 'session_available',
      message: 'Saved LinkedIn session found. Sync can authenticate with stored cookies.',
      checks
    });
  }

  return linkedinSyncReadinessSchema.parse({
    accountId,
    ready: false,
    reason: 'browser_session_missing',
    message:
      'No reusable LinkedIn session found. Configure CHROME_CDP_URL, provide USER_DATA_DIR, or save a browser session first.',
    checks
  });
}

async function assertManualBrowserSyncReady(input: { accountId: string; provider: string }) {
  const readiness = await getManualBrowserSyncReadiness(input.accountId);

  if (!readiness.ready) {
    throw new AppError(readiness.message, {
      code: 'MANUAL_SYNC_NOT_READY',
      status: 400,
      details: {
        reason: readiness.reason,
        checks: readiness.checks,
        accountId: input.accountId
      }
    });
  }

  if (!readiness.checks.hasCdpUrl && !readiness.checks.hasUserDataDir && !readiness.checks.hasSavedSession) {
    throw new AppError('LinkedIn browser sync is not ready.', {
      code: 'MANUAL_SYNC_NOT_READY',
      status: 400,
      details: {
        reason: 'browser_session_missing',
        accountId: input.accountId
      }
    });
  }
}