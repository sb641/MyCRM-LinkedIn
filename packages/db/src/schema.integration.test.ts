import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { createDb } from './client';
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
});
