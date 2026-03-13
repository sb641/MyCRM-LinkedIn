import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { createDb } from './client';
import { createJobRepository, createSyncRunRepository } from './repositories';
import { contacts, conversations, drafts, messages } from './schema';
import { buildSeedData } from './seed-data';

function createTempDbPath(name: string) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mycrm-db-')), `${name}.sqlite`);
}

async function migrateDb(databaseUrl: string) {
  const { db, sqlite } = await createDb(databaseUrl);
  const existingTables = await sqlite.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'contacts'");
  if (existingTables.length === 0) {
    const migrationSql = fs.readFileSync(path.resolve(import.meta.dirname, '../drizzle/0000_phase1.sql'), 'utf8');
    await sqlite.exec(migrationSql);
  }

  return { db, sqlite };
}

describe('Phase 1 schema', () => {
  it('runs migrations on a clean database and can re-run them', async () => {
    const databaseUrl = `file:${createTempDbPath('migrate')}`;
    const first = await migrateDb(databaseUrl);
    await first.sqlite.close();

    const second = await migrateDb(databaseUrl);
    const tables = await second.sqlite.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'contacts'");

    expect(tables).toHaveLength(1);
    await second.sqlite.close();
  });

  it('enforces foreign keys and cascades dependent rows on contact delete', async () => {
    const databaseUrl = `file:${createTempDbPath('cascade')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);
    const seed = buildSeedData();

    await db.insert(contacts).values(seed.contacts.slice(0, 1));
    await db.insert(conversations).values(seed.conversations.slice(0, 1));
    await db.insert(messages).values(seed.messages.filter((message) => message.conversationId === seed.conversations[0].id).slice(0, 1));
    await db.insert(drafts).values(seed.drafts.slice(0, 1));

    await db.delete(contacts).where(eq(contacts.id, seed.contacts[0].id));

    expect(await db.select().from(conversations)).toHaveLength(0);
    expect(await db.select().from(messages)).toHaveLength(0);
    expect(await db.select().from(drafts)).toHaveLength(0);
    await sqlite.close();
  });

  it('has required indexes', async () => {
    const databaseUrl = `file:${createTempDbPath('indexes')}`;
    const { sqlite } = await migrateDb(databaseUrl);
    const indexes = await sqlite.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index'");
    const names = indexes.map((entry) => entry.name);

    expect(names).toContain('contacts_relationship_status_idx');
    expect(names).toContain('contacts_last_interaction_at_idx');
    expect(names).toContain('conversations_contact_id_idx');
    expect(names).toContain('messages_conversation_timestamp_idx');
    expect(names).toContain('jobs_status_scheduled_for_idx');
    await sqlite.close();
  });

  it('supports seed insertion and dedupe by linkedin_message_id', async () => {
    const databaseUrl = `file:${createTempDbPath('seed')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);
    const seed = buildSeedData();

    await db.insert(contacts).values(seed.contacts);
    await db.insert(conversations).values(seed.conversations);
    await db.insert(messages).values(seed.messages);
    await db.insert(drafts).values(seed.drafts);

    const [contactCount] = await sqlite.all<{ count: number }>('SELECT count(*) AS count FROM contacts');
    const [messageCount] = await sqlite.all<{ count: number }>('SELECT count(*) AS count FROM messages');

    expect(contactCount?.count).toBe(20);
    expect(messageCount?.count).toBeGreaterThanOrEqual(100);
    await expect(db.insert(messages).values(seed.messages[0])).rejects.toThrow();
    await sqlite.close();
  });

  it('stores relationship, draft, and send statuses independently', async () => {
    const databaseUrl = `file:${createTempDbPath('statuses')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);
    const seed = buildSeedData();

    await db.insert(contacts).values(seed.contacts.slice(0, 1));
    await db.insert(conversations).values(seed.conversations.slice(0, 1));
    await db.insert(drafts)
      .values([
        {
          ...seed.drafts[0],
          contactId: seed.contacts[0].id,
          conversationId: seed.conversations[0].id,
          draftStatus: 'approved',
          sendStatus: 'queued'
        }
      ]);

    const [storedContact] = await sqlite.all<{ relationship_status: string }>('SELECT relationship_status FROM contacts LIMIT 1');
    const [storedDraft] = await sqlite.all<{ draft_status: string; send_status: string }>(
      'SELECT draft_status, send_status FROM drafts LIMIT 1'
    );

    expect(storedContact?.relationship_status).toBe(seed.contacts[0].relationshipStatus);
    expect(storedDraft?.draft_status).toBe('approved');
    expect(storedDraft?.send_status).toBe('queued');
    await sqlite.close();
  });

  it('persists job status updates across reopened connections', async () => {
    const databaseUrl = `file:${createTempDbPath('job-persistence')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);
    let enqueuedJobId = '';

    try {
      const repository = createJobRepository(db, sqlite);
      const enqueued = await repository.enqueueJob('generate_draft', { contactId: 'contact-001' });
      enqueuedJobId = enqueued.jobId;
      const claimed = await repository.claimNextJob();

      expect(claimed?.id).toBe(enqueued.jobId);

      await repository.markJobSucceeded(enqueued.jobId);
    } finally {
      await sqlite.close();
    }

    const reopened = await createDb(databaseUrl);

    try {
      const jobs = await createJobRepository(reopened.db, reopened.sqlite).listJobs();
      const persistedJob = jobs.find((job) => job.id === enqueuedJobId);

      expect(persistedJob?.status).toBe('succeeded');
    } finally {
      await reopened.sqlite.close();
    }
  });

  it('schedules a retry before marking a job as failed terminally', async () => {
    const databaseUrl = `file:${createTempDbPath('job-retry-policy')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);

    try {
      const repository = createJobRepository(db, sqlite);
      const enqueued = await repository.enqueueJob('generate_draft', { contactId: 'contact-001' });
      const claimed = await repository.claimNextJob();

      expect(claimed?.id).toBe(enqueued.jobId);

      await repository.markJobFailed(enqueued.jobId, 'temporary failure');

      const [retriedJob] = await repository.listJobs();
      expect(retriedJob?.status).toBe('retry_scheduled');
      expect(retriedJob?.lastError).toBe('temporary failure');
      expect(retriedJob?.scheduledFor).not.toBeNull();
    } finally {
      await sqlite.close();
    }
  });

  it('requeues stale running jobs when the lock timeout expires', async () => {
    const databaseUrl = `file:${createTempDbPath('job-stale-lock')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);

    try {
      const repository = createJobRepository(db, sqlite);
      const enqueued = await repository.enqueueJob('generate_draft', { contactId: 'contact-001' });
      const claimed = await repository.claimNextJob();

      expect(claimed?.id).toBe(enqueued.jobId);

      const retryPolicy = repository.getRetryPolicy();
      await sqlite.exec(`
        UPDATE jobs
        SET locked_at = ${Date.now() - retryPolicy.lockTimeoutMs - 1000}
        WHERE id = '${enqueued.jobId}'
      `);

      const reclaimed = await repository.claimNextJob();
      expect(reclaimed?.id).toBe(enqueued.jobId);
      expect(reclaimed?.status).toBe('running');
      expect(reclaimed?.attemptCount).toBe(2);
    } finally {
      await sqlite.close();
    }
  });

  it('writes audit log entries for job lifecycle transitions', async () => {
    const databaseUrl = `file:${createTempDbPath('job-audit-log')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);

    try {
      const repository = createJobRepository(db, sqlite);
      const enqueued = await repository.enqueueJob('generate_draft', { contactId: 'contact-001' });
      await repository.claimNextJob();
      await repository.markJobSucceeded(enqueued.jobId);

      const auditEntries = await repository.listJobAuditEntries(enqueued.jobId);

      expect(auditEntries.map((entry) => entry.action)).toEqual([
        'job.enqueued',
        'job.claimed',
        'job.succeeded'
      ]);
    } finally {
      await sqlite.close();
    }
  });

  it('stores sync run summaries for mock import flows', async () => {
    const databaseUrl = `file:${createTempDbPath('sync-runs')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);

    try {
      const repository = createSyncRunRepository(db, sqlite);
      const syncRunId = await repository.createSyncRun({
        provider: 'fake-linkedin'
      });

      await repository.markSyncRunFinished({
        syncRunId,
        status: 'succeeded',
        itemsScanned: 1,
        itemsImported: 1
      });

      const syncRuns = await repository.listSyncRuns();

      expect(syncRuns[0]).toMatchObject({
        id: syncRunId,
        provider: 'fake-linkedin',
        status: 'succeeded',
        itemsScanned: 1,
        itemsImported: 1
      });
    } finally {
      await sqlite.close();
    }
  });
});
