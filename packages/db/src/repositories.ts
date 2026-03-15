import { sql } from 'drizzle-orm';
import type { NodeDatabaseClient, NodeSqliteConnection } from './server/node-sqlite';
import { accountAliases, accounts, contacts, drafts } from './schema';
import type {
  AccountDetailDto,
  AccountSummaryDto,
  AssignContactsToAccountInput,
  JobType,
  MergeAccountsInput,
  RelationshipStatus,
  RestoreWorkspaceInput,
  SendStatus,
  SettingKey,
  SettingValueDto,
  WorkspaceBackupSnapshotDto
} from '@mycrm/core';
import { redactObject } from '@mycrm/core';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const JOB_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const JOB_RETRY_DELAY_MS = 30 * 1000;
const MAX_JOB_ATTEMPTS = 3;
const SECRET_STORE_DIR = path.resolve(process.cwd(), '.mycrm');
const SECRET_STORE_PATH = path.join(SECRET_STORE_DIR, 'secrets.json');

type RepositoryDbClient = NodeDatabaseClient;
type RepositorySqliteConnection = NodeSqliteConnection;

type SecretStore = Partial<Record<SettingKey, { value: string; updatedAt: number }>>;

async function readSecretStore(): Promise<SecretStore> {
  try {
    const content = await readFile(SECRET_STORE_PATH, 'utf8');
    return JSON.parse(content) as SecretStore;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

async function writeSecretStore(store: SecretStore) {
  await mkdir(SECRET_STORE_DIR, { recursive: true });
  await writeFile(SECRET_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

async function clearSecretStore() {
  try {
    await rm(SECRET_STORE_PATH, { force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

async function listTableRows<T extends Record<string, unknown>>(
  sqlite: RepositorySqliteConnection,
  tableName: string
) {
  return sqlite.all<T>(`SELECT * FROM ${tableName}`);
}

function normalizeWorkspaceRow(
  tableName: string,
  row: Record<string, unknown>
) {
  const columnMap: Record<string, Record<string, string>> = {
    accounts: {
      mergedIntoAccountId: 'merged_into_account_id',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    account_aliases: {
      accountId: 'account_id',
      createdAt: 'created_at'
    },
    contacts: {
      profileUrl: 'profile_url',
      linkedinProfileId: 'linkedin_profile_id',
      accountId: 'account_id',
      outreachStatus: 'outreach_status',
      nextReminderAt: 'next_reminder_at',
      deletedAt: 'deleted_at',
      seniorityBucket: 'seniority_bucket',
      buyingRole: 'buying_role',
      relationshipStatus: 'relationship_status',
      lastInteractionAt: 'last_interaction_at',
      lastReplyAt: 'last_reply_at',
      lastSentAt: 'last_sent_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    conversations: {
      contactId: 'contact_id',
      linkedinThreadId: 'linkedin_thread_id',
      lastMessageDate: 'last_message_date',
      lastSender: 'last_sender',
      lastSyncedAt: 'last_synced_at',
      deletedAt: 'deleted_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    messages: {
      conversationId: 'conversation_id',
      linkedinMessageId: 'linkedin_message_id',
      senderType: 'sender_type',
      isInbound: 'is_inbound',
      rawPayload: 'raw_payload',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    drafts: {
      contactId: 'contact_id',
      conversationId: 'conversation_id',
      goalText: 'goal_text',
      approvedText: 'approved_text',
      draftStatus: 'draft_status',
      sendStatus: 'send_status',
      modelName: 'model_name',
      approvedAt: 'approved_at',
      sentAt: 'sent_at',
      deletedAt: 'deleted_at',
      createdAt: 'created_at'
    },
    draft_variants: {
      draftId: 'draft_id',
      variantIndex: 'variant_index'
    },
    jobs: {
      attemptCount: 'attempt_count',
      lockedAt: 'locked_at',
      lastError: 'last_error',
      scheduledFor: 'scheduled_for',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    sync_runs: {
      startedAt: 'started_at',
      finishedAt: 'finished_at',
      itemsScanned: 'items_scanned',
      itemsImported: 'items_imported'
    },
    audit_log: {
      entityType: 'entity_type',
      entityId: 'entity_id',
      createdAt: 'created_at'
    }
  };

  const mapping = columnMap[tableName] ?? {};

  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [mapping[key] ?? key, value])
  );
}

function toSqlLiteral(value: unknown) {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  return `'${JSON.stringify(value).slice(1, -1).replace(/'/g, "''")}'`;
}

async function replaceTableRows(sqlite: RepositorySqliteConnection, tableName: string, rows: Array<Record<string, unknown>>) {
  for (const row of rows) {
    const normalizedRow = normalizeWorkspaceRow(tableName, row);
    const columns = Object.keys(normalizedRow);
    if (columns.length === 0) {
      continue;
    }

    const values = columns.map((column) => toSqlLiteral(normalizedRow[column]));
    await sqlite.exec(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')})`);
  }
}

async function upsertTableRows(sqlite: RepositorySqliteConnection, tableName: string, rows: Array<Record<string, unknown>>) {
  for (const row of rows) {
    const normalizedRow = normalizeWorkspaceRow(tableName, row);
    const columns = Object.keys(normalizedRow);
    if (columns.length === 0) {
      continue;
    }

    const values = columns.map((column) => toSqlLiteral(normalizedRow[column]));
    await sqlite.exec(`INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')})`);
  }
}

function maskSecret(value: string) {
  if (value.length <= 4) {
    return '****';
  }

  return `${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}

async function appendAuditLog(
  sqlite: RepositorySqliteConnection,
  args: {
    entityType: string;
    entityId: string;
    action: string;
    payload: Record<string, unknown>;
  }
) {
  const auditId = `audit-${args.entityType}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const safeAuditId = auditId.replace(/'/g, "''");
  const safeEntityType = args.entityType.replace(/'/g, "''");
  const safeEntityId = args.entityId.replace(/'/g, "''");
  const safeAction = args.action.replace(/'/g, "''");
  const safePayload = JSON.stringify(args.payload).replace(/'/g, "''");
  const now = Date.now();

  await sqlite.exec(`
    INSERT INTO audit_log (
      id,
      entity_type,
      entity_id,
      action,
      payload,
      created_at
    ) VALUES (
      '${safeAuditId}',
      '${safeEntityType}',
      '${safeEntityId}',
      '${safeAction}',
      '${safePayload}',
      ${now}
    )
  `);
}

export async function withTransaction<T>(db: RepositoryDbClient, callback: (tx: RepositoryDbClient) => Promise<T>) {
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

export function createInboxRepository(_db: RepositoryDbClient, sqlite: RepositorySqliteConnection) {
  return {
    async listInbox() {
      const rows = await sqlite.all<{
        contactId: string;
        conversationId: string;
        contactName: string;
        company: string | null;
        headline: string | null;
        accountId: string | null;
        outreachStatus: string | null;
        nextReminderAt: number | null;
        seniorityBucket: string | null;
        buyingRole: string | null;
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
          c.account_id AS accountId,
          c.outreach_status AS outreachStatus,
          c.next_reminder_at AS nextReminderAt,
          c.seniority_bucket AS seniorityBucket,
          c.buying_role AS buyingRole,
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
        WHERE c.deleted_at IS NULL
          AND conv.deleted_at IS NULL
          AND (d.id IS NULL OR d.deleted_at IS NULL)
        ORDER BY conv.last_message_date DESC
      `);

      return rows.map((row) => ({
        ...row,
        company: row.company ?? null,
        headline: row.headline ?? null,
        accountId: row.accountId ?? null,
        outreachStatus: row.outreachStatus ?? null,
        nextReminderAt: row.nextReminderAt ?? null,
        seniorityBucket: row.seniorityBucket ?? null,
        buyingRole: row.buyingRole ?? null,
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

function createAccountId() {
  return `account-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createAccountAliasId() {
  return `account-alias-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function createAccountRepository(db: RepositoryDbClient, sqlite: RepositorySqliteConnection) {
  return {
    async listAccounts(): Promise<AccountSummaryDto[]> {
      const rows = await sqlite.all<{
        id: string;
        name: string;
        domain: string | null;
        notes: string | null;
        createdAt: number;
        updatedAt: number;
        contactCount: number;
        aliasCount: number;
      }>(`
        SELECT
          a.id AS id,
          a.name AS name,
          a.domain AS domain,
          a.notes AS notes,
          a.created_at AS createdAt,
          a.updated_at AS updatedAt,
          COUNT(DISTINCT c.id) AS contactCount,
          COUNT(DISTINCT aa.id) AS aliasCount
        FROM accounts a
        LEFT JOIN contacts c ON c.account_id = a.id AND c.deleted_at IS NULL
        LEFT JOIN account_aliases aa ON aa.account_id = a.id
        WHERE a.merged_into_account_id IS NULL
        GROUP BY a.id
        ORDER BY a.updated_at DESC, a.name ASC
      `);

      return rows.map((row) => ({
        ...row,
        domain: row.domain ?? null,
        notes: row.notes ?? null,
        contactCount: Number(row.contactCount ?? 0),
        aliasCount: Number(row.aliasCount ?? 0)
      }));
    },

    async findAccountById(accountId: string): Promise<AccountDetailDto | null> {
      const safeAccountId = accountId.replace(/'/g, "''");
      const accountRows = await sqlite.all<{
        id: string;
        name: string;
        domain: string | null;
        notes: string | null;
        createdAt: number;
        updatedAt: number;
        contactCount: number;
        aliasCount: number;
      }>(`
        SELECT
          a.id AS id,
          a.name AS name,
          a.domain AS domain,
          a.notes AS notes,
          a.created_at AS createdAt,
          a.updated_at AS updatedAt,
          COUNT(DISTINCT c.id) AS contactCount,
          COUNT(DISTINCT aa.id) AS aliasCount
        FROM accounts a
        LEFT JOIN contacts c ON c.account_id = a.id AND c.deleted_at IS NULL
        LEFT JOIN account_aliases aa ON aa.account_id = a.id
        WHERE a.id = '${safeAccountId}'
        GROUP BY a.id
        LIMIT 1
      `);

      if (accountRows.length === 0) {
        return null;
      }

      const aliasRows = await sqlite.all<{
        id: string;
        accountId: string;
        alias: string;
        source: string;
        createdAt: number;
      }>(`
        SELECT
          id,
          account_id AS accountId,
          alias,
          source,
          created_at AS createdAt
        FROM account_aliases
        WHERE account_id = '${safeAccountId}'
        ORDER BY created_at ASC, alias ASC
      `);

      const contactRows = await sqlite.all<{
        id: string;
        name: string;
        company: string | null;
        position: string | null;
        headline: string | null;
        seniorityBucket: string | null;
        buyingRole: string | null;
        relationshipStatus: RelationshipStatus;
        lastInteractionAt: number | null;
      }>(`
        SELECT
          id,
          name,
          company,
          position,
          headline,
          seniority_bucket AS seniorityBucket,
          buying_role AS buyingRole,
          relationship_status AS relationshipStatus,
          last_interaction_at AS lastInteractionAt
        FROM contacts
        WHERE account_id = '${safeAccountId}'
          AND deleted_at IS NULL
        ORDER BY name ASC
      `);

      return {
        account: {
          ...accountRows[0],
          domain: accountRows[0].domain ?? null,
          notes: accountRows[0].notes ?? null,
          contactCount: Number(accountRows[0].contactCount ?? 0),
          aliasCount: Number(accountRows[0].aliasCount ?? 0),
          aliases: aliasRows
        },
        contacts: contactRows.map((row) => ({
          ...row,
          company: row.company ?? null,
          position: row.position ?? null,
          headline: row.headline ?? null,
          seniorityBucket: row.seniorityBucket ?? null,
          buyingRole: row.buyingRole ?? null,
          lastInteractionAt: row.lastInteractionAt ?? null
        }))
      };
    },

    async createAccount(input: { name: string; domain?: string; notes?: string; alias?: string }) {
      const accountId = createAccountId();
      const now = Date.now();
      const normalizedName = input.name.trim();

      await db.insert(accounts).values({
        id: accountId,
        name: normalizedName,
        domain: input.domain?.trim() ? input.domain.trim() : null,
        notes: input.notes?.trim() ? input.notes.trim() : null,
        mergedIntoAccountId: null,
        createdAt: now,
        updatedAt: now
      });

      const aliases = new Set([normalizedName]);
      if (input.alias?.trim()) {
        aliases.add(input.alias.trim());
      }

      for (const alias of aliases) {
        await db.insert(accountAliases).values({
          id: createAccountAliasId(),
          accountId,
          alias,
          source: alias === normalizedName ? 'account_name' : 'manual',
          createdAt: now
        });
      }

      return this.findAccountById(accountId);
    },

    async assignContactsToAccount(accountId: string, input: AssignContactsToAccountInput) {
      const safeAccountId = accountId.replace(/'/g, "''");
      const existing = await sqlite.all<{ id: string }>(`SELECT id FROM accounts WHERE id = '${safeAccountId}' LIMIT 1`);
      if (existing.length === 0) {
        return 0;
      }

      const now = Date.now();
      let updatedCount = 0;

      for (const contactId of input.contactIds) {
        const safeContactId = contactId.replace(/'/g, "''");
        const contactRows = await sqlite.all<{ company: string | null }>(`
          SELECT company
          FROM contacts
          WHERE id = '${safeContactId}'
          LIMIT 1
        `);

        if (contactRows.length === 0) {
          continue;
        }

        await sqlite.exec(`
          UPDATE contacts
          SET account_id = '${safeAccountId}',
              updated_at = ${now}
          WHERE id = '${safeContactId}'
        `);
        updatedCount += 1;

        const company = contactRows[0].company?.trim();
        if (company) {
          const safeCompany = company.replace(/'/g, "''");
          await sqlite.exec(`
            INSERT OR IGNORE INTO account_aliases (id, account_id, alias, source, created_at)
            VALUES ('${createAccountAliasId()}', '${safeAccountId}', '${safeCompany}', 'contact_company', ${now})
          `);
        }
      }

      await sqlite.exec(`
        UPDATE accounts
        SET updated_at = ${now}
        WHERE id = '${safeAccountId}'
      `);

      return updatedCount;
    },

    async mergeAccounts(input: MergeAccountsInput) {
      if (input.sourceAccountId === input.targetAccountId) {
        throw new Error('Source and target accounts must be different');
      }

      const safeSourceId = input.sourceAccountId.replace(/'/g, "''");
      const safeTargetId = input.targetAccountId.replace(/'/g, "''");
      const now = Date.now();

      const sourceRows = await sqlite.all<{ id: string; name: string }>(`
        SELECT id, name
        FROM accounts
        WHERE id = '${safeSourceId}'
          AND merged_into_account_id IS NULL
        LIMIT 1
      `);
      const targetRows = await sqlite.all<{ id: string }>(`
        SELECT id
        FROM accounts
        WHERE id = '${safeTargetId}'
          AND merged_into_account_id IS NULL
        LIMIT 1
      `);

      if (sourceRows.length === 0 || targetRows.length === 0) {
        return null;
      }

      await withSqliteTransaction(sqlite, async () => {
        await sqlite.exec(`
          UPDATE contacts
          SET account_id = '${safeTargetId}',
              updated_at = ${now}
          WHERE account_id = '${safeSourceId}'
        `);

        if (input.preserveSourceAsAlias) {
          const safeSourceName = sourceRows[0].name.replace(/'/g, "''");
          await sqlite.exec(`
            INSERT OR IGNORE INTO account_aliases (id, account_id, alias, source, created_at)
            VALUES ('${createAccountAliasId()}', '${safeTargetId}', '${safeSourceName}', 'merged_account_name', ${now})
          `);
        }

        const sourceAliases = await sqlite.all<{ alias: string; source: string }>(`
          SELECT alias, source
          FROM account_aliases
          WHERE account_id = '${safeSourceId}'
        `);

        for (const alias of sourceAliases) {
          const safeAlias = alias.alias.replace(/'/g, "''");
          const safeSource = alias.source.replace(/'/g, "''");
          await sqlite.exec(`
            INSERT OR IGNORE INTO account_aliases (id, account_id, alias, source, created_at)
            VALUES ('${createAccountAliasId()}', '${safeTargetId}', '${safeAlias}', '${safeSource}', ${now})
          `);
        }

        await sqlite.exec(`
          UPDATE accounts
          SET merged_into_account_id = '${safeTargetId}',
              updated_at = ${now}
          WHERE id = '${safeSourceId}'
        `);

        await sqlite.exec(`
          UPDATE accounts
          SET updated_at = ${now}
          WHERE id = '${safeTargetId}'
        `);
      });

      return this.findAccountById(input.targetAccountId);
    }
  };
}

export function createContactRepository(_db: RepositoryDbClient, sqlite: RepositorySqliteConnection) {
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
        accountId: string | null;
        outreachStatus: string | null;
        nextReminderAt: number | null;
        seniorityBucket: string | null;
        buyingRole: string | null;
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
          account_id AS accountId,
          outreach_status AS outreachStatus,
          next_reminder_at AS nextReminderAt,
          seniority_bucket AS seniorityBucket,
          buying_role AS buyingRole,
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
          accountId: contactRows[0].accountId ?? null,
          outreachStatus: contactRows[0].outreachStatus ?? null,
          nextReminderAt: contactRows[0].nextReminderAt ?? null,
          seniorityBucket: contactRows[0].seniorityBucket ?? null,
          buyingRole: contactRows[0].buyingRole ?? null,
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

export function createMutationRepository(db: RepositoryDbClient, sqlite: RepositorySqliteConnection) {
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

    async approveDraft(draftId: string, approvedText: string, sendStatus: SendStatus = 'queued') {
      const safeDraftId = draftId.replace(/'/g, "''");
      const safeApprovedText = approvedText.replace(/'/g, "''");
      const safeSendStatus = sendStatus.replace(/'/g, "''");
      const now = Date.now();
      const rows = await sqlite.all<{ id: string }>(`
        SELECT id
        FROM drafts
        WHERE id = '${safeDraftId}'
        LIMIT 1
      `);
      const existing = rows[0];

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

      await appendAuditLog(sqlite, {
        entityType: 'draft',
        entityId: draftId,
        action: 'draft.approved',
        payload: {
          sendStatus,
          approvedAt: now
        }
      });

      return 1;
    },

    async markDraftSent(draftId: string) {
      const safeDraftId = draftId.replace(/'/g, "''");
      const now = Date.now();
      const rows = await sqlite.all<{ id: string; contactId: string }>(`
        SELECT id, contact_id AS contactId
        FROM drafts
        WHERE id = '${safeDraftId}'
        LIMIT 1
      `);
      const existing = rows[0];

      if (!existing) {
        return 0;
      }

      await sqlite.exec(`
        UPDATE drafts
        SET send_status = 'sent',
            sent_at = ${now}
        WHERE id = '${safeDraftId}'
      `);

      const safeContactId = existing.contactId.replace(/'/g, "''");
      await sqlite.exec(`
        UPDATE contacts
        SET last_sent_at = ${now},
            updated_at = ${now}
        WHERE id = '${safeContactId}'
      `);

      await appendAuditLog(sqlite, {
        entityType: 'draft',
        entityId: draftId,
        action: 'draft.sent',
        payload: {
          sendStatus: 'sent',
          sentAt: now,
          contactId: existing.contactId
        }
      });

      return 1;
    },

    async markDraftSendFailed(draftId: string) {
      const safeDraftId = draftId.replace(/'/g, "''");
      const rows = await sqlite.all<{ id: string }>(`
        SELECT id
        FROM drafts
        WHERE id = '${safeDraftId}'
        LIMIT 1
      `);
      const existing = rows[0];

      if (!existing) {
        return 0;
      }

      await sqlite.exec(`
        UPDATE drafts
        SET send_status = 'failed'
        WHERE id = '${safeDraftId}'
      `);

      await appendAuditLog(sqlite, {
        entityType: 'draft',
        entityId: draftId,
        action: 'draft.send_failed',
        payload: {
          sendStatus: 'failed'
        }
      });

      return 1;
    },

    async findDraftForSend(draftId: string) {
      const safeDraftId = draftId.replace(/'/g, "''");
      const rows = await sqlite.all<{
        id: string;
        conversationId: string;
        approvedText: string | null;
        draftStatus: string;
        sendStatus: string;
        sentAt: number | null;
      }>(`
        SELECT
          id,
          conversation_id AS conversationId,
          approved_text AS approvedText,
          draft_status AS draftStatus,
          send_status AS sendStatus,
          sent_at AS sentAt
        FROM drafts
        WHERE id = '${safeDraftId}'
        LIMIT 1
      `);
      const draft = rows[0];

      return draft ?? null;
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

export function createJobRepository(_db: RepositoryDbClient, sqlite: RepositorySqliteConnection) {
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

    async listJobAuditEntries(jobId: string) {
      const safeJobId = jobId.replace(/'/g, "''");

      return sqlite.all<{
        id: string;
        entityType: string;
        entityId: string;
        action: string;
        payload: string;
        createdAt: number;
      }>(`
        SELECT
          id,
          entity_type AS entityType,
          entity_id AS entityId,
          action,
          payload,
          created_at AS createdAt
        FROM audit_log
        WHERE entity_type = 'job'
          AND entity_id = '${safeJobId}'
        ORDER BY created_at ASC
      `);
    },

    async enqueueJob(type: JobType, payload: Record<string, unknown>, scheduledFor?: number | null) {
      const jobId = `job-generated-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      const now = Date.now();
      const safeType = type.replace(/'/g, "''");
      const safePayload = JSON.stringify(payload).replace(/'/g, "''");
      const scheduledValue = scheduledFor ?? now;

      if (type === 'send_message' && typeof payload.draftId === 'string') {
        const safeDraftId = payload.draftId.replace(/'/g, "''");
        const existingJobs = await sqlite.all<{ id: string }>(`
          SELECT id
          FROM jobs
          WHERE type = 'send_message'
            AND status IN ('queued', 'running', 'retry_scheduled')
            AND json_extract(payload, '$.draftId') = '${safeDraftId}'
          ORDER BY created_at ASC
          LIMIT 1
        `);
        const existingJob = existingJobs[0];

        if (existingJob) {
          return { jobId: existingJob.id, status: 'queued' as const };
        }
      }

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

      await appendAuditLog(sqlite, {
        entityType: 'job',
        entityId: jobId,
        action: 'job.enqueued',
        payload: {
          type,
          scheduledFor: scheduledValue,
          status: 'queued'
        }
      });

      return { jobId, status: 'queued' as const };
    },

    async claimNextJob() {
      const now = Date.now();

      await sqlite.exec(`
        UPDATE jobs
        SET status = 'queued',
            locked_at = NULL,
            updated_at = ${now}
        WHERE status = 'running'
          AND locked_at IS NOT NULL
          AND locked_at <= ${now - JOB_LOCK_TIMEOUT_MS}
      `);

      await sqlite.exec(`
        UPDATE jobs
        SET status = 'queued',
            updated_at = ${now}
        WHERE status = 'retry_scheduled'
          AND (scheduled_for IS NULL OR scheduled_for <= ${now})
      `);

      const [job] = await sqlite.all<{
        id: string;
        type: string;
        payload: string;
        attemptCount: number;
        status: string;
      }>(`
        SELECT
          id,
          type,
          payload,
          attempt_count AS attemptCount,
          status
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

      await appendAuditLog(sqlite, {
        entityType: 'job',
        entityId: job.id,
        action: 'job.claimed',
        payload: {
          status: 'running',
          lockedAt: now,
          attemptCount: Number(job.attemptCount ?? 0) + 1
        }
      });

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

      await appendAuditLog(sqlite, {
        entityType: 'job',
        entityId: jobId,
        action: 'job.succeeded',
        payload: {
          status: 'succeeded'
        }
      });
    },

    async markJobFailed(jobId: string, errorMessage: string) {
      const safeJobId = jobId.replace(/'/g, "''");
      const safeError = errorMessage.replace(/'/g, "''");
      const now = Date.now();
      const [job] = await sqlite.all<{ attemptCount: number }>(`
        SELECT attempt_count AS attemptCount
        FROM jobs
        WHERE id = '${safeJobId}'
        LIMIT 1
      `);

      if (!job) {
        return;
      }

      const attemptCount = Number(job.attemptCount ?? 0);
      const shouldRetry = attemptCount < MAX_JOB_ATTEMPTS;
      const nextStatus = shouldRetry ? 'retry_scheduled' : 'failed';
      const scheduledFor = shouldRetry ? now + JOB_RETRY_DELAY_MS : 'NULL';

      await sqlite.exec(`
        UPDATE jobs
        SET status = '${nextStatus}',
            locked_at = NULL,
            last_error = '${safeError}',
            scheduled_for = ${scheduledFor},
            updated_at = ${now}
        WHERE id = '${safeJobId}'
      `);

      await appendAuditLog(sqlite, {
        entityType: 'job',
        entityId: jobId,
        action: shouldRetry ? 'job.retry_scheduled' : 'job.failed',
        payload: {
          status: nextStatus,
          attemptCount,
          lastError: errorMessage,
          scheduledFor: shouldRetry ? now + JOB_RETRY_DELAY_MS : null
        }
      });
    },

    getRetryPolicy() {
      return {
        lockTimeoutMs: JOB_LOCK_TIMEOUT_MS,
        retryDelayMs: JOB_RETRY_DELAY_MS,
        maxAttempts: MAX_JOB_ATTEMPTS
      };
    }
  };
}

export function createSyncRunRepository(_db: RepositoryDbClient, sqlite: RepositorySqliteConnection) {
  return {
    async createSyncRun(args: {
      provider: string;
      status?: 'running' | 'succeeded' | 'failed';
      startedAt?: number;
      finishedAt?: number | null;
      itemsScanned?: number;
      itemsImported?: number;
      error?: string | null;
    }) {
      const syncRunId = `sync-run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const now = args.startedAt ?? Date.now();
      const safeProvider = args.provider.replace(/'/g, "''");
      const safeStatus = (args.status ?? 'running').replace(/'/g, "''");
      const safeError = args.error ? `'${args.error.replace(/'/g, "''")}'` : 'NULL';
      const finishedAt = args.finishedAt ?? 'NULL';
      const itemsScanned = args.itemsScanned ?? 0;
      const itemsImported = args.itemsImported ?? 0;

      await sqlite.exec(`
        INSERT INTO sync_runs (
          id,
          provider,
          status,
          started_at,
          finished_at,
          items_scanned,
          items_imported,
          error
        ) VALUES (
          '${syncRunId}',
          '${safeProvider}',
          '${safeStatus}',
          ${now},
          ${finishedAt},
          ${itemsScanned},
          ${itemsImported},
          ${safeError}
        )
      `);

      return syncRunId;
    },

    async markSyncRunFinished(args: {
      syncRunId: string;
      status: 'succeeded' | 'failed';
      finishedAt?: number;
      itemsScanned: number;
      itemsImported: number;
      error?: string | null;
    }) {
      const safeSyncRunId = args.syncRunId.replace(/'/g, "''");
      const safeStatus = args.status.replace(/'/g, "''");
      const safeError = args.error ? `'${args.error.replace(/'/g, "''")}'` : 'NULL';
      const finishedAt = args.finishedAt ?? Date.now();

      await sqlite.exec(`
        UPDATE sync_runs
        SET status = '${safeStatus}',
            finished_at = ${finishedAt},
            items_scanned = ${args.itemsScanned},
            items_imported = ${args.itemsImported},
            error = ${safeError}
        WHERE id = '${safeSyncRunId}'
      `);
    },

    async listSyncRuns(limit = 20) {
      const safeLimit = Math.max(1, Math.min(limit, 200));

      return sqlite.all<{
        id: string;
        provider: string;
        status: string;
        startedAt: number;
        finishedAt: number | null;
        itemsScanned: number;
        itemsImported: number;
        error: string | null;
      }>(`
        SELECT
          id,
          provider,
          status,
          started_at AS startedAt,
          finished_at AS finishedAt,
          items_scanned AS itemsScanned,
          items_imported AS itemsImported,
          error
        FROM sync_runs
        ORDER BY started_at DESC
        LIMIT ${safeLimit}
      `);
    }
  };
}

export function createSettingsRepository(_db: RepositoryDbClient, sqlite: RepositorySqliteConnection) {
  return {
    async listSettings(options?: { includeSecrets?: boolean }) {
      const rows = await sqlite.all<{
        key: SettingKey;
        value: string;
        isSecret: number;
      }>(`
        SELECT key, value, is_secret AS isSecret
        FROM settings
        ORDER BY key ASC
      `);
      const secretStore = await readSecretStore();

      return rows.map<SettingValueDto>((row) => {
        const isSecret = Boolean(row.isSecret);
        const secretEntry = secretStore[row.key as SettingKey];
        const rawValue = isSecret ? secretEntry?.value ?? '' : row.value;

        return {
          key: row.key,
          value: options?.includeSecrets && isSecret ? rawValue : isSecret ? '' : row.value,
          isSecret,
          updatedAt: secretEntry?.updatedAt ?? null,
          redactedValue: isSecret ? maskSecret(rawValue) : null
        };
      });
    },

    async upsertSettings(values: Array<{ key: SettingKey; value: string; isSecret: boolean; reset?: boolean }>) {
      const secretStore = await readSecretStore();
      const now = Date.now();

      for (const entry of values) {
        const safeKey = entry.key.replace(/'/g, "''");
        const safeValue = entry.isSecret ? '__secret__' : entry.value.replace(/'/g, "''");
        const isSecret = entry.isSecret ? 1 : 0;

        await sqlite.exec(`
          INSERT INTO settings (key, value, is_secret)
          VALUES ('${safeKey}', '${safeValue}', ${isSecret})
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            is_secret = excluded.is_secret
        `);

        if (entry.isSecret) {
          if (entry.reset) {
            delete secretStore[entry.key];
          } else if (entry.value.trim().length > 0) {
            secretStore[entry.key] = {
              value: entry.value,
              updatedAt: now
            };
          }
        }
      }

      await writeSecretStore(secretStore);

      await appendAuditLog(sqlite, {
        entityType: 'settings',
        entityId: 'workspace',
        action: 'settings.updated',
        payload: redactObject({
          keys: values.map((entry) => entry.key),
          values
        })
      });
    },

    async exportSettings(includeSecrets: boolean) {
      const values = await this.listSettings({ includeSecrets });

      return {
        version: 1 as const,
        exportedAt: Date.now(),
        values: values.map((entry) => ({
          ...entry,
          value: includeSecrets || !entry.isSecret ? entry.value : ''
        }))
      };
    },

    async importSettings(args: {
      values: Array<{ key: SettingKey; value: string; isSecret: boolean }>;
      mode: 'merge' | 'replace';
    }) {
      if (args.mode === 'replace') {
        await sqlite.exec('DELETE FROM settings');
        await clearSecretStore();
      }
      await this.upsertSettings(args.values);

      await appendAuditLog(sqlite, {
        entityType: 'settings',
        entityId: 'workspace',
        action: 'settings.imported',
        payload: {
          mode: args.mode,
          count: args.values.length
        }
      });
    },

    async exportWorkspace(includeSecrets: boolean): Promise<WorkspaceBackupSnapshotDto> {
      const settings = await this.listSettings({ includeSecrets });

      return {
        version: 1,
        scope: 'workspace',
        exportedAt: Date.now(),
        settings: settings.map((entry) => ({
          ...entry,
          value: includeSecrets || !entry.isSecret ? entry.value : ''
        })),
        data: {
          accounts: await listTableRows(sqlite, 'accounts'),
          accountAliases: await listTableRows(sqlite, 'account_aliases'),
          contacts: await listTableRows(sqlite, 'contacts'),
          conversations: await listTableRows(sqlite, 'conversations'),
          messages: await listTableRows(sqlite, 'messages'),
          drafts: await listTableRows(sqlite, 'drafts'),
          draftVariants: await listTableRows(sqlite, 'draft_variants'),
          jobs: await listTableRows(sqlite, 'jobs'),
          syncRuns: await listTableRows(sqlite, 'sync_runs'),
          auditLog: await listTableRows(sqlite, 'audit_log')
        }
      };
    },

    async importWorkspace(args: RestoreWorkspaceInput) {
      if (args.mode === 'replace') {
        await sqlite.exec('DELETE FROM draft_variants');
        await sqlite.exec('DELETE FROM drafts');
        await sqlite.exec('DELETE FROM messages');
        await sqlite.exec('DELETE FROM conversations');
        await sqlite.exec('DELETE FROM contacts');
        await sqlite.exec('DELETE FROM account_aliases');
        await sqlite.exec('DELETE FROM accounts');
        await sqlite.exec('DELETE FROM jobs');
        await sqlite.exec('DELETE FROM sync_runs');
        await sqlite.exec('DELETE FROM audit_log');

        await replaceTableRows(sqlite, 'accounts', args.data.accounts);
        await replaceTableRows(sqlite, 'contacts', args.data.contacts);
        await replaceTableRows(sqlite, 'account_aliases', args.data.accountAliases);
        await replaceTableRows(sqlite, 'conversations', args.data.conversations);
        await replaceTableRows(sqlite, 'messages', args.data.messages);
        await replaceTableRows(sqlite, 'drafts', args.data.drafts);
        await replaceTableRows(sqlite, 'draft_variants', args.data.draftVariants);
        await replaceTableRows(sqlite, 'jobs', args.data.jobs);
        await replaceTableRows(sqlite, 'sync_runs', args.data.syncRuns);
        await replaceTableRows(sqlite, 'audit_log', args.data.auditLog);
        await sqlite.exec('DELETE FROM settings');
        await clearSecretStore();
      } else {
        await upsertTableRows(sqlite, 'accounts', args.data.accounts);
        await upsertTableRows(sqlite, 'account_aliases', args.data.accountAliases);
        await upsertTableRows(sqlite, 'contacts', args.data.contacts);
        await upsertTableRows(sqlite, 'conversations', args.data.conversations);
        await upsertTableRows(sqlite, 'messages', args.data.messages);
        await upsertTableRows(sqlite, 'drafts', args.data.drafts);
        await upsertTableRows(sqlite, 'draft_variants', args.data.draftVariants);
        await upsertTableRows(sqlite, 'jobs', args.data.jobs);
        await upsertTableRows(sqlite, 'sync_runs', args.data.syncRuns);
        await upsertTableRows(sqlite, 'audit_log', args.data.auditLog);
      }

      await this.importSettings({
        values: args.settings,
        mode: args.mode
      });
    }
  };
}

export async function withSqliteTransaction<T>(
  sqlite: RepositorySqliteConnection,
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
