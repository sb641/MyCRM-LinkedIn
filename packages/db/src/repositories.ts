import { sql } from 'drizzle-orm';
import type { DatabaseClient, SqliteConnection } from './client';
import { contacts, drafts } from './schema';
import type { JobType, RelationshipStatus, SendStatus } from '@mycrm/core';

export async function withTransaction<T>(db: DatabaseClient, callback: (tx: DatabaseClient) => Promise<T>) {
  await db.run(sql.raw('BEGIN'));

  try {
    const result = await callback(db);
    await db.run(sql.raw('COMMIT'));
    return result;
  } catch (error) {
    await db.run(sql.raw('ROLLBACK'));
    throw error;
  }
}

export function createInboxRepository(_db: DatabaseClient, sqlite: SqliteConnection) {
  return {
    async listInbox() {
      const rows = await sqlite.all<{
        contactId: string;
        conversationId: string;
        contactName: string;
        company: string | null;
        headline: string | null;
        relationshipStatus: string;
        draftStatus: string | null;
        sendStatus: string | null;
        lastMessageAt: number | null;
        lastMessageText: string | null;
        lastSender: string | null;
        unreadCount: number;
      }>(`
        SELECT
          c.id AS contactId,
          conv.id AS conversationId,
          c.name AS contactName,
          c.company AS company,
          c.headline AS headline,
          c.relationship_status AS relationshipStatus,
          d.draft_status AS draftStatus,
          d.send_status AS sendStatus,
          conv.last_message_date AS lastMessageAt,
          m.content AS lastMessageText,
          conv.last_sender AS lastSender,
          0 AS unreadCount
        FROM conversations conv
        INNER JOIN contacts c ON c.id = conv.contact_id
        LEFT JOIN drafts d ON d.conversation_id = conv.id
        LEFT JOIN messages m
          ON m.conversation_id = conv.id
         AND m.timestamp = conv.last_message_date
        ORDER BY conv.last_message_date DESC
      `);

      return rows.map((row) => ({
        ...row,
        company: row.company ?? null,
        headline: row.headline ?? null,
        draftStatus: row.draftStatus ?? 'none',
        sendStatus: row.sendStatus ?? 'idle',
        lastMessageAt: row.lastMessageAt ?? null,
        lastMessageText: row.lastMessageText ?? null,
        lastSender: row.lastSender ?? null,
        unreadCount: Number(row.unreadCount ?? 0)
      }));
    }
  };
}

export function createContactRepository(_db: DatabaseClient, sqlite: SqliteConnection) {
  return {
    async findContactConversationDetails(contactId: string) {
      const safeContactId = contactId.replace(/'/g, "''");
      const contactRows = await sqlite.all<{
        id: string;
        name: string;
        company: string | null;
        position: string | null;
        headline: string | null;
        profileUrl: string | null;
        relationshipStatus: string;
        lastInteractionAt: number | null;
        lastReplyAt: number | null;
        lastSentAt: number | null;
      }>(`
        SELECT
          id,
          name,
          company,
          position,
          headline,
          profile_url AS profileUrl,
          relationship_status AS relationshipStatus,
          last_interaction_at AS lastInteractionAt,
          last_reply_at AS lastReplyAt,
          last_sent_at AS lastSentAt
        FROM contacts
        WHERE id = '${safeContactId}'
        LIMIT 1
      `);

      const conversationRows = await sqlite.all<{
        id: string;
        linkedinThreadId: string;
        lastMessageDate: number | null;
        lastSender: string | null;
        lastSyncedAt: number | null;
      }>(`
        SELECT
          id,
          linkedin_thread_id AS linkedinThreadId,
          last_message_date AS lastMessageDate,
          last_sender AS lastSender,
          last_synced_at AS lastSyncedAt
        FROM conversations
        WHERE contact_id = '${safeContactId}'
        ORDER BY last_message_date DESC
        LIMIT 1
      `);

      if (contactRows.length === 0 || conversationRows.length === 0) {
        return null;
      }

      const conversationId = conversationRows[0].id;

      const safeConversationId = conversationId.replace(/'/g, "''");

      const messageRows = await sqlite.all<{
        id: string;
        linkedinMessageId: string;
        sender: string;
        senderType: string;
        content: string;
        timestamp: number;
        isInbound: number;
      }>(`
        SELECT
          id,
          linkedin_message_id AS linkedinMessageId,
          sender,
          sender_type AS senderType,
          content,
          timestamp,
          is_inbound AS isInbound
        FROM messages
        WHERE conversation_id = '${safeConversationId}'
        ORDER BY timestamp ASC
      `);

      const draftRows = await sqlite.all<{
        id: string;
        goalText: string;
        approvedText: string | null;
        draftStatus: string;
        sendStatus: string;
        modelName: string | null;
        approvedAt: number | null;
        sentAt: number | null;
        createdAt: number;
      }>(`
        SELECT
          id,
          goal_text AS goalText,
          approved_text AS approvedText,
          draft_status AS draftStatus,
          send_status AS sendStatus,
          model_name AS modelName,
          approved_at AS approvedAt,
          sent_at AS sentAt,
          created_at AS createdAt
        FROM drafts
        WHERE conversation_id = '${safeConversationId}'
        ORDER BY created_at DESC
      `);

      return {
        contact: {
          ...contactRows[0],
          company: contactRows[0].company ?? null,
          position: contactRows[0].position ?? null,
          headline: contactRows[0].headline ?? null,
          profileUrl: contactRows[0].profileUrl ?? null,
          lastInteractionAt: contactRows[0].lastInteractionAt ?? null,
          lastReplyAt: contactRows[0].lastReplyAt ?? null,
          lastSentAt: contactRows[0].lastSentAt ?? null
        },
        conversation: {
          ...conversationRows[0],
          lastMessageDate: conversationRows[0].lastMessageDate ?? null,
          lastSender: conversationRows[0].lastSender ?? null,
          lastSyncedAt: conversationRows[0].lastSyncedAt ?? null
        },
        messages: messageRows.map((message) => ({
          ...message,
          isInbound: Boolean(message.isInbound)
        })),
        drafts: draftRows.map((draft) => ({
          ...draft,
          approvedText: draft.approvedText ?? null,
          modelName: draft.modelName ?? null,
          approvedAt: draft.approvedAt ?? null,
          sentAt: draft.sentAt ?? null
        }))
      };
    }
  };
}

export function createMutationRepository(db: DatabaseClient, sqlite: SqliteConnection) {
  return {
    async updateRelationshipStatus(contactId: string, relationshipStatus: RelationshipStatus) {
      const safeContactId = contactId.replace(/'/g, "''");
      const safeStatus = relationshipStatus.replace(/'/g, "''");
      const now = Date.now();
      const [existing] = await sqlite.all<{ id: string }>(`SELECT id FROM contacts WHERE id = '${safeContactId}' LIMIT 1`);

      if (!existing) {
        return 0;
      }

      await sqlite.exec(`
        UPDATE contacts
        SET relationship_status = '${safeStatus}',
            updated_at = ${now}
        WHERE id = '${safeContactId}'
      `);

      return 1;
    },

    async approveDraft(draftId: string, approvedText: string, sendStatus: SendStatus) {
      const safeDraftId = draftId.replace(/'/g, "''");
      const safeApprovedText = approvedText.replace(/'/g, "''");
      const safeSendStatus = sendStatus.replace(/'/g, "''");
      const now = Date.now();
      const [existing] = await sqlite.all<{ id: string }>(`SELECT id FROM drafts WHERE id = '${safeDraftId}' LIMIT 1`);

      if (!existing) {
        return 0;
      }

      await sqlite.exec(`
        UPDATE drafts
        SET approved_text = '${safeApprovedText}',
            draft_status = 'approved',
            send_status = '${safeSendStatus}',
            approved_at = ${now}
        WHERE id = '${safeDraftId}'
      `);

      return 1;
    },

    async createGeneratedDraft(args: {
      draftId: string;
      contactId: string;
      conversationId: string;
      goalText: string;
      modelName: string;
      variants: Array<{ id: string; text: string; selected: boolean; score: number | null }>;
    }) {
      const safeDraftId = args.draftId.replace(/'/g, "''");
      const safeContactId = args.contactId.replace(/'/g, "''");
      const safeConversationId = args.conversationId.replace(/'/g, "''");
      const safeGoalText = args.goalText.replace(/'/g, "''");
      const safeModelName = args.modelName.replace(/'/g, "''");
      const now = Date.now();

      const [contact] = await sqlite.all<{ id: string }>(`SELECT id FROM contacts WHERE id = '${safeContactId}' LIMIT 1`);
      const [conversation] = await sqlite.all<{ id: string }>(
        `SELECT id FROM conversations WHERE id = '${safeConversationId}' AND contact_id = '${safeContactId}' LIMIT 1`
      );

      if (!contact || !conversation) {
        return null;
      }

      await sqlite.exec(`
        INSERT INTO drafts (
          id,
          contact_id,
          conversation_id,
          goal_text,
          approved_text,
          draft_status,
          send_status,
          model_name,
          approved_at,
          sent_at,
          created_at
        ) VALUES (
          '${safeDraftId}',
          '${safeContactId}',
          '${safeConversationId}',
          '${safeGoalText}',
          NULL,
          'generated',
          'idle',
          '${safeModelName}',
          NULL,
          NULL,
          ${now}
        )
      `);

      for (const variant of args.variants) {
        const safeVariantId = variant.id.replace(/'/g, "''");
        const safeText = variant.text.replace(/'/g, "''");
        const selected = variant.selected ? 1 : 0;
        const score = variant.score ?? 'NULL';

        await sqlite.exec(`
          INSERT INTO draft_variants (
            id,
            draft_id,
            variant_index,
            text,
            selected,
            score
          ) VALUES (
            '${safeVariantId}',
            '${safeDraftId}',
            ${args.variants.findIndex((item) => item.id === variant.id)},
            '${safeText}',
            ${selected},
            ${score}
          )
        `);
      }

      return {
        draftId: args.draftId,
        contactId: args.contactId,
        conversationId: args.conversationId,
        goalText: args.goalText,
        draftStatus: 'generated' as const,
        modelName: args.modelName,
        variants: args.variants
      };
    }
  };
}

export function createJobRepository(_db: DatabaseClient, sqlite: SqliteConnection) {
  return {
    async listJobs() {
      return sqlite.all<{
        id: string;
        type: string;
        status: string;
        payload: string;
        attemptCount: number;
        lockedAt: number | null;
        lastError: string | null;
        scheduledFor: number | null;
        createdAt: number;
        updatedAt: number;
      }>(`
        SELECT
          id,
          type,
          status,
          payload,
          attempt_count AS attemptCount,
          locked_at AS lockedAt,
          last_error AS lastError,
          scheduled_for AS scheduledFor,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM jobs
        ORDER BY created_at DESC
      `);
    },

    async enqueueJob(type: JobType, payload: Record<string, unknown>, scheduledFor?: number | null) {
      const jobId = `job-generated-${Date.now()}`;
      const now = Date.now();
      const safeType = type.replace(/'/g, "''");
      const safePayload = JSON.stringify(payload).replace(/'/g, "''");
      const scheduledValue = scheduledFor ?? now;

      await sqlite.exec(`
        INSERT INTO jobs (
          id,
          type,
          payload,
          status,
          attempt_count,
          locked_at,
          last_error,
          scheduled_for,
          created_at,
          updated_at
        ) VALUES (
          '${jobId}',
          '${safeType}',
          '${safePayload}',
          'queued',
          0,
          NULL,
          NULL,
          ${scheduledValue},
          ${now},
          ${now}
        )
      `);

      return { jobId, status: 'queued' as const };
    },

    async claimNextJob() {
      const now = Date.now();
      const [job] = await sqlite.all<{
        id: string;
        type: string;
        payload: string;
        attemptCount: number;
      }>(`
        SELECT
          id,
          type,
          payload,
          attempt_count AS attemptCount
        FROM jobs
        WHERE status = 'queued'
          AND (scheduled_for IS NULL OR scheduled_for <= ${now})
        ORDER BY scheduled_for ASC, created_at ASC
        LIMIT 1
      `);

      if (!job) {
        return null;
      }

      const safeJobId = job.id.replace(/'/g, "''");
      await sqlite.exec(`
        UPDATE jobs
        SET status = 'running',
            locked_at = ${now},
            attempt_count = attempt_count + 1,
            updated_at = ${now}
        WHERE id = '${safeJobId}'
      `);

      return {
        ...job,
        status: 'running' as const,
        lockedAt: now,
        attemptCount: Number(job.attemptCount ?? 0) + 1
      };
    },

    async markJobSucceeded(jobId: string) {
      const safeJobId = jobId.replace(/'/g, "''");
      const now = Date.now();
      await sqlite.exec(`
        UPDATE jobs
        SET status = 'succeeded',
            locked_at = NULL,
            last_error = NULL,
            updated_at = ${now}
        WHERE id = '${safeJobId}'
      `);

      const [updatedJob] = await sqlite.all<{ status: string }>(`
        SELECT status
        FROM jobs
        WHERE id = '${safeJobId}'
        LIMIT 1
      `);

      if (updatedJob?.status !== 'succeeded') {
        throw new Error(`Failed to persist succeeded status for job ${jobId}`);
      }
    },

    async markJobFailed(jobId: string, errorMessage: string) {
      const safeJobId = jobId.replace(/'/g, "''");
      const safeError = errorMessage.replace(/'/g, "''");
      const now = Date.now();
      await sqlite.exec(`
        UPDATE jobs
        SET status = 'failed',
            locked_at = NULL,
            last_error = '${safeError}',
            updated_at = ${now}
        WHERE id = '${safeJobId}'
      `);
    }
  };
}

export async function withSqliteTransaction<T>(
  sqlite: SqliteConnection,
  callback: () => Promise<T>
) {
  await sqlite.exec('BEGIN');

  try {
    const result = await callback();
    await sqlite.exec('COMMIT');
    return result;
  } catch (error) {
    await sqlite.exec('ROLLBACK');
    throw error;
  }
}