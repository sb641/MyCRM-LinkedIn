import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '@mycrm/core';
import { createNodeDb } from '@mycrm/db/server';
import { runMigrations } from '../../../../packages/db/src/migrate';
import { seedDatabase } from '../../../../packages/db/src/seed';
import { approveDraft, generateDraftsBulk, queueApprovedDraftSend, updateContactRelationshipStatus } from './crm-service';

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
  const { sqlite } = await createNodeDb(databaseUrl);
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
    const { sqlite } = await createNodeDb(databaseUrl);
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

  it('queues send_message for an approved draft', async () => {
    const databaseUrl = createTempDbUrl('queue-send');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    const result = await queueApprovedDraftSend(
      {
        draftId: 'draft-003',
        conversationId: 'conversation-003',
        accountId: 'local-account',
        provider: 'linkedin-browser'
      },
      databaseUrl
    );
    const { sqlite } = await createNodeDb(databaseUrl);
    const [row] = await sqlite.all<{ type: string; payload: string; status: string }>(
      "SELECT type, payload, status FROM jobs WHERE id = '" + result.jobId + "'"
    );
    await sqlite.close();

    expect(result.status).toBe('queued');
    expect(row?.type).toBe('send_message');
    expect(row?.status).toBe('queued');
    expect(row?.payload).toContain('draft-003');
  });

  it('reuses an existing queued send_message job for the same approved draft', async () => {
    const databaseUrl = createTempDbUrl('queue-send-dedupe');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    const first = await queueApprovedDraftSend(
      {
        draftId: 'draft-003',
        conversationId: 'conversation-003',
        accountId: 'local-account',
        provider: 'linkedin-browser'
      },
      databaseUrl
    );

    const second = await queueApprovedDraftSend(
      {
        draftId: 'draft-003',
        conversationId: 'conversation-003',
        accountId: 'local-account',
        provider: 'linkedin-browser'
      },
      databaseUrl
    );

    const { sqlite } = await createNodeDb(databaseUrl);
    const rows = await sqlite.all<{ id: string; status: string }>(
      "SELECT id, status FROM jobs WHERE type = 'send_message' AND json_extract(payload, '$.draftId') = 'draft-003' ORDER BY created_at ASC"
    );
    await sqlite.close();

    expect(second.jobId).toBe(first.jobId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('queued');
  });

  it('generates drafts in bulk by orchestrating repeated single-contact generation', async () => {
    const databaseUrl = createTempDbUrl('bulk-generate');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    const result = await generateDraftsBulk(
      {
        selections: [
          { contactId: 'contact-001', conversationId: 'conversation-001' },
          { contactId: 'contact-002', conversationId: 'conversation-002' }
        ],
        goal: 'Book a short intro call',
        options: {
          includeLink: 'https://example.com/brief',
          callToAction: 'Reply with a time next week',
          tone: 'Concise and warm',
          constraints: 'Keep it under 80 words',
          useRecentConversationContext: true,
          useAccountContext: true,
          varyMessageByRole: true,
          avoidRepeatingAngleWithinAccount: true
        }
      },
      databaseUrl
    );

    expect(result.requestedCount).toBe(2);
    expect(result.generatedCount).toBe(2);
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts[0]?.draft.goalText).toContain('Book a short intro call');
    expect(result.drafts[0]?.draft.goalText).toContain('Reply with a time next week');
  });

});