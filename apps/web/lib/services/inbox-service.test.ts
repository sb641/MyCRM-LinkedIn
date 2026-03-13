import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NotFoundError } from '@mycrm/core';
import { runMigrations } from '../../../../packages/db/src/migrate';
import { seedDatabase } from '../../../../packages/db/src/seed';
import { getContactConversationDetails, listInboxItems } from './inbox-service';

function createTempDbUrl(name: string) {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mycrm-phase2-')), `${name}.sqlite`);
  return `file:${filePath}`;
}

describe('inbox service', () => {
  it('lists inbox items from seeded data', async () => {
    const databaseUrl = createTempDbUrl('inbox');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    const items = await listInboxItems(databaseUrl);

    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toMatchObject({
      contactId: expect.any(String),
      conversationId: expect.any(String),
      contactName: expect.any(String)
    });
  });

  it('returns contact conversation details', async () => {
    const databaseUrl = createTempDbUrl('details');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    const details = await getContactConversationDetails('contact-001', databaseUrl);

    expect(details.contact.id).toBe('contact-001');
    expect(details.messages.length).toBeGreaterThan(0);
  });

  it('throws not found for unknown contact', async () => {
    const databaseUrl = createTempDbUrl('missing');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    await expect(getContactConversationDetails('missing-contact', databaseUrl)).rejects.toBeInstanceOf(NotFoundError);
  });
});