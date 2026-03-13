import {
  enqueueJobInputSchema,
  enqueueJobResultSchema,
  jobDtoSchema
} from '@mycrm/core';
import { createDb, createJobRepository } from '@mycrm/db';

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