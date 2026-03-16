import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { createNodeDb } from './server/node-sqlite';
import { createAccountRepository, createCampaignRepository, createJobRepository, createMutationRepository, createReminderRepository, createSettingsRepository, createSyncRunRepository } from './repositories';
import { accounts, accountAliases, campaigns, contacts, conversations, drafts, messages, reminders } from './schema';
import { buildSeedData } from './seed-data';

function createTempDbPath(name: string) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mycrm-db-')), `${name}.sqlite`);
}

async function migrateDb(databaseUrl: string) {
  const { db, sqlite } = await createNodeDb(databaseUrl);
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

    await db.insert(accounts).values(seed.accounts.slice(0, 1));
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
    expect(names).toContain('accounts_name_idx');
    expect(names).toContain('account_aliases_account_alias_idx');
    expect(names).toContain('conversations_contact_id_idx');
    expect(names).toContain('messages_conversation_timestamp_idx');
    expect(names).toContain('jobs_status_scheduled_for_idx');
    await sqlite.close();
  });

  it('supports seed insertion and dedupe by linkedin_message_id', async () => {
    const databaseUrl = `file:${createTempDbPath('seed')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);
    const seed = buildSeedData();

    await db.insert(accounts).values(seed.accounts);
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

    await db.insert(accounts).values(seed.accounts.slice(0, 1));
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

    const reopened = await createNodeDb(databaseUrl);

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

  it('ignores and restores a contact with suppression state', async () => {
    const databaseUrl = `file:${createTempDbPath('sync-suppressions-ignore-restore')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);
    const seed = buildSeedData();

    try {
      await db.insert(accounts).values(seed.accounts.slice(0, 1));
      await db.insert(contacts).values(seed.contacts.slice(0, 1));
      await db.insert(conversations).values(seed.conversations.slice(0, 1));
      await db.insert(drafts).values(seed.drafts.slice(0, 1));

      const repository = createMutationRepository(db, sqlite);
      await repository.ignoreContact(seed.contacts[0].id, 'user requested', true);

      const suppressions = await repository.listSyncSuppressions();
      const [storedContactAfterIgnore] = await sqlite.all<{ deleted_at: number | null }>(
        `SELECT deleted_at FROM contacts WHERE id = '${seed.contacts[0].id}'`
      );
      const [storedConversationAfterIgnore] = await sqlite.all<{ deleted_at: number | null }>(
        `SELECT deleted_at FROM conversations WHERE id = '${seed.conversations[0].id}'`
      );
      const [storedDraftAfterIgnore] = await sqlite.all<{ deleted_at: number | null }>(
        `SELECT deleted_at FROM drafts WHERE id = '${seed.drafts[0].id}'`
      );

      expect(suppressions).toHaveLength(1);
      expect(suppressions[0]?.contactId).toBe(seed.contacts[0].id);
      expect(storedContactAfterIgnore?.deleted_at).not.toBeNull();
      expect(storedConversationAfterIgnore?.deleted_at).not.toBeNull();
      expect(storedDraftAfterIgnore?.deleted_at).not.toBeNull();

      await repository.restoreSuppression(suppressions[0]!.id);

      const remainingSuppressions = await repository.listSyncSuppressions();
      const [storedContactAfterRestore] = await sqlite.all<{ deleted_at: number | null }>(
        `SELECT deleted_at FROM contacts WHERE id = '${seed.contacts[0].id}'`
      );
      const [storedConversationAfterRestore] = await sqlite.all<{ deleted_at: number | null }>(
        `SELECT deleted_at FROM conversations WHERE id = '${seed.conversations[0].id}'`
      );
      const [storedDraftAfterRestore] = await sqlite.all<{ deleted_at: number | null }>(
        `SELECT deleted_at FROM drafts WHERE id = '${seed.drafts[0].id}'`
      );

      expect(remainingSuppressions).toEqual([]);
      expect(storedContactAfterRestore?.deleted_at).toBeNull();
      expect(storedConversationAfterRestore?.deleted_at).toBeNull();
      expect(storedDraftAfterRestore?.deleted_at).toBeNull();
    } finally {
      await sqlite.close();
    }
  });

  it('stores secrets outside the settings table and returns redacted values by default', async () => {
    const databaseUrl = `file:${createTempDbPath('settings-secrets')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);

    try {
      const repository = createSettingsRepository(db, sqlite);
      await repository.upsertSettings([
        { key: 'gemini_api_key', value: 'super-secret-key', isSecret: true },
        { key: 'followup_days', value: '9', isSecret: false }
      ]);

      const settingsRows = await sqlite.all<{ key: string; value: string; is_secret: number }>(
        "SELECT key, value, is_secret FROM settings WHERE key IN ('gemini_api_key', 'followup_days') ORDER BY key ASC"
      );
      const listed = await repository.listSettings();
      const exported = await repository.exportSettings(true);

      expect(settingsRows.find((row) => row.key === 'gemini_api_key')?.value).toBe('__secret__');
      expect(listed.find((entry) => entry.key === 'gemini_api_key')?.redactedValue).toContain('*');
      expect(listed.find((entry) => entry.key === 'gemini_api_key')?.value).toBe('');
      expect(exported.values.find((entry) => entry.key === 'gemini_api_key')?.value).toBe('super-secret-key');
    } finally {
      await sqlite.close();
    }
  });

  it('exports a workspace snapshot with seeded data', async () => {
    const databaseUrl = `file:${createTempDbPath('workspace-export')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);
    const seed = buildSeedData();

    try {
      await db.insert(accounts).values(seed.accounts);
      await db.insert(contacts).values(seed.contacts);
      await db.insert(conversations).values(seed.conversations);
      await db.insert(messages).values(seed.messages);
      await db.insert(drafts).values(seed.drafts);

      const repository = createSettingsRepository(db, sqlite);
      await repository.upsertSettings([
        { key: 'followup_days', value: '9', isSecret: false },
        { key: 'gemini_api_key', value: 'super-secret-key', isSecret: true }
      ]);

      const snapshot = await repository.exportWorkspace(false);

      expect(snapshot.scope).toBe('workspace');
      expect(snapshot.data.accounts.length).toBe(seed.accounts.length);
      expect(snapshot.data.accountAliases).toEqual([]);
      expect(snapshot.data.contacts.length).toBeGreaterThan(0);
      expect(snapshot.data.conversations.length).toBeGreaterThan(0);
      expect(snapshot.data.syncSuppressions).toEqual([]);
      expect(snapshot.settings.length).toBeGreaterThan(0);
      expect(snapshot.settings.find((entry) => entry.key === 'gemini_api_key')?.value).toBe('');
    } finally {
      await sqlite.close();
    }
  });

  it('replaces workspace data from a snapshot in replace mode', async () => {
    const databaseUrl = `file:${createTempDbPath('workspace-restore-replace')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);
    const seed = buildSeedData();

    try {
      await db.insert(accounts).values(seed.accounts.slice(0, 2));
      await db.insert(contacts).values(seed.contacts.slice(0, 2));
      await db.insert(conversations).values(seed.conversations.slice(0, 2));
      await db.insert(messages).values(seed.messages.filter((message) => message.conversationId === seed.conversations[0].id).slice(0, 2));
      await db.insert(drafts).values(seed.drafts.slice(0, 1));

      const repository = createSettingsRepository(db, sqlite);
      await repository.upsertSettings([{ key: 'followup_days', value: '9', isSecret: false }]);

      await repository.importWorkspace({
        version: 1,
        scope: 'workspace',
        mode: 'replace',
        settings: [{ key: 'followup_days', value: '14', isSecret: false }],
        data: {
          accounts: [seed.accounts[5]],
          accountAliases: [],
          contacts: [seed.contacts[5]],
          conversations: [seed.conversations[5]],
          messages: seed.messages.filter((message) => message.conversationId === seed.conversations[5].id).slice(0, 1),
          drafts: [],
          draftVariants: [],
          jobs: [],
          syncRuns: [],
          syncSuppressions: [],
          auditLog: []
        }
      });

      const [contactCount] = await sqlite.all<{ count: number }>('SELECT count(*) AS count FROM contacts');
      const [conversationCount] = await sqlite.all<{ count: number }>('SELECT count(*) AS count FROM conversations');
      const listed = await repository.listSettings();

      expect(contactCount?.count).toBe(1);
      expect(conversationCount?.count).toBe(1);
      expect(listed.find((entry) => entry.key === 'followup_days')?.value).toBe('14');
    } finally {
      await sqlite.close();
    }
  });

  it('merges workspace data from a snapshot in merge mode', async () => {
    const databaseUrl = `file:${createTempDbPath('workspace-restore-merge')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);
    const seed = buildSeedData();

    try {
      await db.insert(accounts).values(seed.accounts.slice(0, 2));
      await db.insert(contacts).values(seed.contacts.slice(0, 1));
      await db.insert(conversations).values(seed.conversations.slice(0, 1));
      await db.insert(messages).values(seed.messages.filter((message) => message.conversationId === seed.conversations[0].id).slice(0, 1));

      const repository = createSettingsRepository(db, sqlite);
      await repository.upsertSettings([{ key: 'followup_days', value: '9', isSecret: false }]);

      await repository.importWorkspace({
        version: 1,
        scope: 'workspace',
        mode: 'merge',
        settings: [{ key: 'default_account_id', value: 'account-2', isSecret: false }],
        data: {
          accounts: [],
          accountAliases: [],
          contacts: [seed.contacts[1]],
          conversations: [seed.conversations[1]],
          messages: seed.messages.filter((message) => message.conversationId === seed.conversations[1].id).slice(0, 1),
          drafts: [],
          draftVariants: [],
          jobs: [],
          syncRuns: [],
          syncSuppressions: [],
          auditLog: []
        }
      });

      const [contactCount] = await sqlite.all<{ count: number }>('SELECT count(*) AS count FROM contacts');
      const listed = await repository.listSettings();

      expect(contactCount?.count).toBe(2);
      expect(listed.find((entry) => entry.key === 'followup_days')?.value).toBe('9');
      expect(listed.find((entry) => entry.key === 'default_account_id')?.value).toBe('account-2');
    } finally {
      await sqlite.close();
    }
  });

  it('supports resetting a stored secret without deleting the setting key', async () => {
    const databaseUrl = `file:${createTempDbPath('settings-reset-secret')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);

    try {
      const repository = createSettingsRepository(db, sqlite);
      await repository.upsertSettings([{ key: 'gemini_api_key', value: 'super-secret-key', isSecret: true }]);
      await repository.upsertSettings([{ key: 'gemini_api_key', value: '', isSecret: true, reset: true }]);

      const listed = await repository.listSettings({ includeSecrets: true });
      const secretEntry = listed.find((entry) => entry.key === 'gemini_api_key');

      expect(secretEntry?.value).toBe('');
      expect(secretEntry?.redactedValue).toBe('****');
    } finally {
      await sqlite.close();
    }
  });

  it('preserves existing secrets during merge imports when the snapshot omits them', async () => {
    const databaseUrl = `file:${createTempDbPath('settings-merge-preserve-secret')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);

    try {
      const repository = createSettingsRepository(db, sqlite);
      await repository.upsertSettings([
        { key: 'gemini_api_key', value: 'existing-secret', isSecret: true },
        { key: 'followup_days', value: '9', isSecret: false }
      ]);

      await repository.importSettings({
        mode: 'merge',
        values: [{ key: 'followup_days', value: '12', isSecret: false }]
      });

      const listed = await repository.listSettings({ includeSecrets: true });

      expect(listed.find((entry) => entry.key === 'gemini_api_key')?.value).toBe('existing-secret');
      expect(listed.find((entry) => entry.key === 'followup_days')?.value).toBe('12');
    } finally {
      await sqlite.close();
    }
  });

  it('clears omitted secrets during replace imports', async () => {
    const databaseUrl = `file:${createTempDbPath('settings-replace-clear-secret')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);

    try {
      const repository = createSettingsRepository(db, sqlite);
      await repository.upsertSettings([
        { key: 'gemini_api_key', value: 'existing-secret', isSecret: true },
        { key: 'followup_days', value: '9', isSecret: false }
      ]);

      await repository.importSettings({
        mode: 'replace',
        values: [{ key: 'followup_days', value: '15', isSecret: false }]
      });

      const listed = await repository.listSettings({ includeSecrets: true });

      expect(listed.find((entry) => entry.key === 'gemini_api_key')).toBeUndefined();
      expect(listed.find((entry) => entry.key === 'followup_days')?.value).toBe('15');
    } finally {
      await sqlite.close();
    }
  });

  it('clears existing workspace secrets during replace restore when the snapshot omits them', async () => {
    const databaseUrl = `file:${createTempDbPath('workspace-replace-clear-secret')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);
    const seed = buildSeedData();

    try {
      await db.insert(accounts).values(seed.accounts.slice(0, 3));
      await db.insert(contacts).values(seed.contacts.slice(0, 1));
      await db.insert(conversations).values(seed.conversations.slice(0, 1));
      await db.insert(messages).values(seed.messages.filter((message) => message.conversationId === seed.conversations[0].id).slice(0, 1));

      const repository = createSettingsRepository(db, sqlite);
      await repository.upsertSettings([
        { key: 'gemini_api_key', value: 'existing-secret', isSecret: true },
        { key: 'followup_days', value: '9', isSecret: false }
      ]);

      await repository.importWorkspace({
        version: 1,
        scope: 'workspace',
        mode: 'replace',
        settings: [{ key: 'followup_days', value: '21', isSecret: false }],
        data: {
          accounts: [seed.accounts[2]],
          accountAliases: [],
          contacts: [seed.contacts[2]],
          conversations: [seed.conversations[2]],
          messages: seed.messages.filter((message) => message.conversationId === seed.conversations[2].id).slice(0, 1),
          drafts: [],
          draftVariants: [],
          jobs: [],
          syncRuns: [],
          auditLog: []
        }
      });

      const listed = await repository.listSettings({ includeSecrets: true });

      expect(listed.find((entry) => entry.key === 'gemini_api_key')).toBeUndefined();
      expect(listed.find((entry) => entry.key === 'followup_days')?.value).toBe('21');
    } finally {
      await sqlite.close();
    }
  });

  it('preserves existing workspace secrets during merge restore when the snapshot omits them', async () => {
    const databaseUrl = `file:${createTempDbPath('workspace-merge-preserve-secret')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);
    const seed = buildSeedData();

    try {
      await db.insert(accounts).values(seed.accounts.slice(0, 4));
      await db.insert(contacts).values(seed.contacts.slice(0, 1));
      await db.insert(conversations).values(seed.conversations.slice(0, 1));
      await db.insert(messages).values(seed.messages.filter((message) => message.conversationId === seed.conversations[0].id).slice(0, 1));

      const repository = createSettingsRepository(db, sqlite);
      await repository.upsertSettings([
        { key: 'gemini_api_key', value: 'existing-secret', isSecret: true },
        { key: 'followup_days', value: '9', isSecret: false }
      ]);

      await repository.importWorkspace({
        version: 1,
        scope: 'workspace',
        mode: 'merge',
        settings: [{ key: 'default_account_id', value: 'account-3', isSecret: false }],
        data: {
          accounts: [],
          accountAliases: [],
          campaigns: [],
          campaignTargets: [],
          reminders: [],
          contacts: [seed.contacts[3]],
          conversations: [seed.conversations[3]],
          messages: seed.messages.filter((message) => message.conversationId === seed.conversations[3].id).slice(0, 1),
          drafts: [],
          draftVariants: [],
          jobs: [],
          syncRuns: [],
          auditLog: []
        }
      });

      const listed = await repository.listSettings({ includeSecrets: true });

      expect(listed.find((entry) => entry.key === 'gemini_api_key')?.value).toBe('existing-secret');
      expect(listed.find((entry) => entry.key === 'default_account_id')?.value).toBe('account-3');
    } finally {
      await sqlite.close();
    }
  });

  it('creates accounts, assigns contacts, and preserves aliases', async () => {
    const databaseUrl = `file:${createTempDbPath('accounts-create-assign')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);
    const seed = buildSeedData();

    try {
      await db.insert(accounts).values(seed.accounts.slice(0, 2));
      await db.insert(contacts).values(seed.contacts.slice(0, 2));

      const repository = createAccountRepository(db, sqlite);
      const created = await repository.createAccount({
        name: 'Acme Corp',
        alias: 'Acme'
      });

      expect(created?.account.name).toBe('Acme Corp');
      expect(created?.account.aliases).toHaveLength(2);

      const updatedCount = await repository.assignContactsToAccount(created!.account.id, {
        contactIds: [seed.contacts[0].id, seed.contacts[1].id]
      });

      expect(updatedCount).toBe(2);

      const assigned = await repository.findAccountById(created!.account.id);
      expect(assigned?.contacts).toHaveLength(2);
      expect(assigned?.contacts.every((contact) => contact.id === seed.contacts[0].id || contact.id === seed.contacts[1].id)).toBe(true);

      expect(assigned?.contacts.some((contact) => contact.id === seed.contacts[0].id)).toBe(true);
      expect(assigned?.contacts.some((contact) => contact.id === seed.contacts[1].id)).toBe(true);
      expect(assigned?.account.aliases.some((alias) => alias.alias === 'Acme')).toBe(true);

      expect(assigned?.account.aliases.some((alias) => alias.alias === 'Acme Corp')).toBe(true);
    } finally {
      await sqlite.close();
    }
  });

  it('merges accounts safely and keeps source aliases', async () => {
    const databaseUrl = `file:${createTempDbPath('accounts-merge')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);
    const seed = buildSeedData();

    try {
      await db.insert(accounts).values(seed.accounts.slice(0, 2));
      await db.insert(contacts).values(seed.contacts.slice(0, 2));
      await db.insert(accounts).values([
        {
          id: 'account-source',
          name: 'Source Co',
          domain: null,
          notes: null,
          mergedIntoAccountId: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'account-target',
          name: 'Target Co',
          domain: null,
          notes: null,
          mergedIntoAccountId: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]);
      await db.insert(accountAliases).values([
        {
          id: 'alias-source',
          accountId: 'account-source',
          alias: 'Source Alias',
          source: 'manual',
          createdAt: Date.now()
        }
      ]);
      await db.update(contacts).set({ accountId: 'account-source' }).where(eq(contacts.id, seed.contacts[0].id));

      const repository = createAccountRepository(db, sqlite);
      const merged = await repository.mergeAccounts({
        sourceAccountId: 'account-source',
        targetAccountId: 'account-target',
        preserveSourceAsAlias: true
      });

      expect(merged?.account.id).toBe('account-target');
      expect(merged?.account.aliases.some((alias) => alias.alias === 'Source Co')).toBe(true);
      expect(merged?.account.aliases.some((alias) => alias.alias === 'Source Alias')).toBe(true);

      const mergedDetail = await repository.findAccountById('account-target');
      expect(mergedDetail?.contacts.some((contact) => contact.id === seed.contacts[0].id)).toBe(true);

      expect(mergedDetail?.contacts.some((contact) => contact.id === seed.contacts[0].id)).toBe(true);
    } finally {
      await sqlite.close();
    }
  });

  it('creates and completes reminders while syncing contact next reminder state', async () => {
    const databaseUrl = `file:${createTempDbPath('reminders-lifecycle')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);
    const seed = buildSeedData();

    try {
      await db.insert(accounts).values(seed.accounts.slice(0, 1));
      await db.insert(contacts).values(seed.contacts.slice(0, 1));

      const repository = createReminderRepository(db, sqlite);
      const dueAt = Date.now() + 2 * 60 * 60 * 1000;
      const created = await repository.upsertReminder({
        entityType: 'contact',
        entityId: seed.contacts[0].id,
        ruleType: 'manual',
        dueAt,
        note: 'Follow up tomorrow morning'
      });

      expect(created?.entityType).toBe('contact');
      expect(created?.dueAt).toBe(dueAt);

      const [contactRow] = await sqlite.all<{ next_reminder_at: number | null }>(
        `SELECT next_reminder_at FROM contacts WHERE id = '${seed.contacts[0].id}' LIMIT 1`
      );
      expect(contactRow?.next_reminder_at).toBe(dueAt);

      const completed = await repository.updateReminder(created!.id, {
        status: 'completed',
        completedAt: Date.now()
      });

      expect(completed?.status).toBe('completed');

      const [clearedContactRow] = await sqlite.all<{ next_reminder_at: number | null }>(
        `SELECT next_reminder_at FROM contacts WHERE id = '${seed.contacts[0].id}' LIMIT 1`
      );
      expect(clearedContactRow?.next_reminder_at).toBeNull();
    } finally {
      await sqlite.close();
    }
  });

  it('creates campaigns, assigns targets, and derives activity from drafts reminders and audit data', async () => {
    const databaseUrl = `file:${createTempDbPath('campaigns-lifecycle')}`;
    const { db, sqlite } = await migrateDb(databaseUrl);
    const seed = buildSeedData();

    try {
      await db.insert(accounts).values(seed.accounts.slice(0, 2));
      await db.insert(contacts).values(seed.contacts.slice(0, 2));
      await db.insert(conversations).values(seed.conversations.slice(0, 2));
      await db.insert(drafts).values(seed.drafts.slice(0, 2));

      const repository = createCampaignRepository(db, sqlite);
      const created = await repository.createCampaign({
        name: 'Q2 Expansion',
        objective: 'Book intro calls with expansion stakeholders',
        status: 'draft',
        defaultPrompt: 'Focus on expansion pain points.',
        tags: ['expansion', 'q2']
      });

      expect(created?.campaign.name).toBe('Q2 Expansion');
      expect(created?.campaign.tags).toEqual(['expansion', 'q2']);

      const withTargets = await repository.addTargets(created!.campaign.id, {
        contactIds: [seed.contacts[0].id, seed.contacts[1].id]
      });

      expect(withTargets?.targets).toHaveLength(2);

      await db.insert(reminders).values({
        id: 'reminder-campaign-001',
        entityType: 'campaign',
        entityId: created!.campaign.id,
        status: 'due_today',
        ruleType: 'manual',
        dueAt: Date.now() + 60 * 60 * 1000,
        completedAt: null,
        note: 'Review campaign progress',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      const detail = await repository.findCampaignById(created!.campaign.id);
      expect(detail?.targets).toHaveLength(2);
      expect(detail?.drafts.length).toBeGreaterThan(0);
      expect(detail?.reminders.some((reminder) => reminder.entityId === created!.campaign.id)).toBe(true);
      expect(detail?.activity.some((item) => item.type === 'audit')).toBe(true);
      expect(detail?.activity.some((item) => item.type === 'draft')).toBe(true);
      expect(detail?.activity.some((item) => item.type === 'reminder')).toBe(true);

      const listed = await repository.listCampaigns();
      expect(listed.some((campaign) => campaign.id === created!.campaign.id && campaign.targetCount === 2)).toBe(true);
    } finally {
      await sqlite.close();
    }
  });
});
