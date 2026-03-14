import {
  jobWithAuditSchema,
  enqueueJobInputSchema,
  enqueueJobResultSchema,
  jobDtoSchema,
  type JobWithAuditDto,
  manualSyncRequestSchema,
  syncRunDtoSchema
} from '@mycrm/core';
import { createJobRepository, createSyncRunRepository, getDb } from '@mycrm/db/server';

export async function listJobs(databaseUrl?: string) {
  const { db, sqlite } = await getDb();

  try {
    const repository = createJobRepository(db, sqlite);
    const jobs = await repository.listJobs();
    return jobDtoSchema.array().parse(jobs);
  } finally {
  }
}

export async function listJobsWithAudit(databaseUrl?: string) {
  const { db, sqlite } = await getDb();

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
  const { db, sqlite } = await getDb();

  try {
    const repository = createJobRepository(db, sqlite);
    const result = await repository.enqueueJob(parsed.type, parsed.payload, parsed.scheduledFor ?? null);
    return enqueueJobResultSchema.parse(result);
  } finally {
  }
}

export async function listSyncRuns(databaseUrl?: string, limit?: number) {
  const { db, sqlite } = await getDb();

  try {
    const repository = createSyncRunRepository(db, sqlite);
    const syncRuns = await repository.listSyncRuns(limit);
    return syncRunDtoSchema.array().parse(syncRuns);
  } finally {
  }
}

export async function enqueueManualBrowserSync(input: unknown, databaseUrl?: string) {
  const parsed = manualSyncRequestSchema.parse(input);

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

export async function listImportThreadJobs(databaseUrl?: string): Promise<JobWithAuditDto[]> {
  const jobs = await listJobsWithAudit(databaseUrl);
  return jobs.filter((entry) => entry.job.type === 'import_threads');
}