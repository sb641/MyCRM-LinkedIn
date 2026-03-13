import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '@mycrm/core';
import { createDb } from '@mycrm/db';
import { runMigrations } from '../../../../packages/db/src/migrate';
import { seedDatabase } from '../../../../packages/db/src/seed';
import { approveDraft, updateContactRelationshipStatus } from './crm-service';

function createTempDbUrl(name: string) {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mycrm-phase2-write-')), `${name}.sqlite`);
  return `file:${filePath}`;
}

describe('crm service', () => {
  it('updates contact relationship status', async () => {
    const databaseUrl = createTempDbUrl('relationship');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    const result = await updateContactRelationshipStatus('contact-001', { relationshipStatus: 'archived' }, databaseUrl);
    const { sqlite } = await createDb(databaseUrl);
    const [row] = await sqlite.all<{ relationship_status: string }>("SELECT relationship_status FROM contacts WHERE id = 'contact-001'");
    await sqlite.close();

    expect(result.success).toBe(true);
    expect(row?.relationship_status).toBe('archived');
  });

  it('approves a draft', async () => {
    const databaseUrl = createTempDbUrl('draft');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    const result = await approveDraft('draft-002', { approvedText: 'Approved manually', sendStatus: 'queued' }, databaseUrl);
    const { sqlite } = await createDb(databaseUrl);
    const [row] = await sqlite.all<{ draft_status: string; approved_text: string; send_status: string }>(
      "SELECT draft_status, approved_text, send_status FROM drafts WHERE id = 'draft-002'"
    );
    await sqlite.close();

    expect(result.success).toBe(true);
    expect(row?.draft_status).toBe('approved');
    expect(row?.approved_text).toBe('Approved manually');
    expect(row?.send_status).toBe('queued');
  });

  it('rejects invalid payloads', async () => {
    await expect(updateContactRelationshipStatus('contact-001', { relationshipStatus: 'bad-status' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws not found for missing draft', async () => {
    const databaseUrl = createTempDbUrl('missing-draft');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    await expect(approveDraft('missing-draft', { approvedText: 'x', sendStatus: 'idle' }, databaseUrl)).rejects.toBeInstanceOf(NotFoundError);
  });
});