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
import {
  getBrowserSession,
  hasImportedProfileMarker,
  hasUsableSavedSession
} from '@/lib/services/browser-session-service';
import { getLinkedInAuthBootstrapState } from '@mycrm/automation/src/auth-config';

async function isChromeCdpReachable(cdpUrl: string) {
  try {
    const versionUrl = new URL('/json/version', cdpUrl);
    const response = await fetch(versionUrl, {
      method: 'GET',
      cache: 'no-store'
    });

    return response.ok;
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
  const hasImportedProfileSession = hasImportedProfileMarker(savedSession?.cookiesJson);
  const bootstrapState = await getLinkedInAuthBootstrapState();
  const hasCdpUrl = bootstrapState.checks.hasCdpUrl || Boolean(env.CHROME_CDP_URL?.trim());
  const cdpReachable = bootstrapState.checks.cdpReachable || (hasCdpUrl ? await isChromeCdpReachable(env.CHROME_CDP_URL?.trim() ?? '') : false);
  const hasUserDataDir = bootstrapState.checks.hasUserDataDir || Boolean(env.USER_DATA_DIR?.trim());
  const hasLinkedinCredentials = bootstrapState.checks.hasLinkedinCredentials;

  const checks = {
    enableRealBrowserSync: env.ENABLE_REAL_BROWSER_SYNC,
    hasCdpUrl,
    cdpReachable,
    hasUserDataDir,
    hasSavedSession,
    hasLinkedinCredentials
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
    if (!cdpReachable) {
      if (hasUserDataDir) {
        return linkedinSyncReadinessSchema.parse({
          accountId,
          ready: true,
          reason: 'profile_configured',
          message:
            'CHROME_CDP_URL is unreachable, but a local Chrome user profile is configured. Sync can fall back to the local browser profile.',
          checks
        });
      }

      if (hasSavedSession) {
        return linkedinSyncReadinessSchema.parse({
          accountId,
          ready: true,
          reason: 'session_available',
          message:
            'CHROME_CDP_URL is unreachable, but a saved LinkedIn session is available. Sync can fall back to stored cookies.',
          checks
        });
      }

      if (hasLinkedinCredentials) {
        return linkedinSyncReadinessSchema.parse({
          accountId,
          ready: true,
          reason: 'credentials_configured',
          message:
            'Chrome DevTools is unreachable, but LinkedIn account credentials are configured. Sync can bootstrap a fresh saved session before importing.',
          checks
        });
      }

      return linkedinSyncReadinessSchema.parse({
        accountId,
        ready: false,
        reason: 'cdp_unreachable',
        message:
          'CHROME_CDP_URL is configured but Chrome DevTools is unreachable. Start Chrome with remote debugging enabled and verify /json/version responds.',
        checks
      });
    }

    return linkedinSyncReadinessSchema.parse({
      accountId,
      ready: true,
      reason: 'cdp_configured',
      message: 'Chrome CDP is configured and reachable. Sync can reuse an authenticated Chrome session.',
      checks
    });
  }

  if (hasUserDataDir && (hasSavedSession || hasLinkedinCredentials || !hasImportedProfileSession)) {
    return linkedinSyncReadinessSchema.parse({
      accountId,
      ready: true,
      reason: 'profile_configured',
      message: 'Chrome user profile is configured. Sync can reuse a local browser profile.',
      checks
    });
  }

  if (hasUserDataDir && hasImportedProfileSession) {
    return linkedinSyncReadinessSchema.parse({
      accountId,
      ready: false,
      reason: 'browser_session_missing',
      message:
        'Chrome user profile is configured, but the saved browser session only contains an imported profile marker and LinkedIn still requires login. Open an authenticated LinkedIn session in that profile, connect Chrome DevTools, or configure LinkedIn credentials for bootstrap.',
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

  if (hasLinkedinCredentials) {
    return linkedinSyncReadinessSchema.parse({
      accountId,
      ready: true,
      reason: 'credentials_configured',
      message: 'LinkedIn account credentials are configured. Sync can sign in and save a reusable browser session.',
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

  if (
    !readiness.checks.hasCdpUrl &&
    !readiness.checks.hasUserDataDir &&
    !readiness.checks.hasSavedSession &&
    !readiness.checks.hasLinkedinCredentials
  ) {
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