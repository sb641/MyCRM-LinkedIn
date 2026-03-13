import {
  jobWithAuditSchema,
  enqueueJobInputSchema,
  enqueueJobResultSchema,
  jobDtoSchema,
  syncRunDtoSchema
} from '@mycrm/core';
import { createDb, createJobRepository, createSyncRunRepository } from '@mycrm/db';

export async function listJobs(databaseUrl?: string) {
  const { db, sqlite } = await createDb(databaseUrl);

  try {
    const repository = createJobRepository(db, sqlite);
    const jobs = await repository.listJobs();
    return jobDtoSchema.array().parse(jobs);
  } finally {
    await sqlite.close();
  }
}

export async function listJobsWithAudit(databaseUrl?: string) {
  const { db, sqlite } = await createDb(databaseUrl);

  try {
    const repository = createJobRepository(db, sqlite);
    const jobs = await repository.listJobs();
    const jobsWithAudit = await Promise.all(
      jobs.map(async (job) => ({
        job,
        auditEntries: await repository.listJobAuditEntries(job.id)
      }))
    );

    return jobWithAuditSchema.array().parse(jobsWithAudit);
  } finally {
    await sqlite.close();
  }
}

export async function enqueueJob(input: unknown, databaseUrl?: string) {
  const parsed = enqueueJobInputSchema.parse(input);
  const { db, sqlite } = await createDb(databaseUrl);

  try {
    const repository = createJobRepository(db, sqlite);
    const result = await repository.enqueueJob(parsed.type, parsed.payload, parsed.scheduledFor ?? null);
    return enqueueJobResultSchema.parse(result);
  } finally {
    await sqlite.close();
  }
}

export async function listSyncRuns(databaseUrl?: string, limit?: number) {
  const { db, sqlite } = await createDb(databaseUrl);

  try {
    const repository = createSyncRunRepository(db, sqlite);
    const syncRuns = await repository.listSyncRuns(limit);
    return syncRunDtoSchema.array().parse(syncRuns);
  } finally {
    await sqlite.close();
  }
}