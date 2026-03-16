import {
  campaignStatuses,
  draftStatuses,
  jobStatuses,
  jobTypes,
  reminderEntityTypes,
  reminderRuleTypes,
  reminderStatuses,
  relationshipStatuses,
  sendStatuses,
  syncRunStatuses
} from '@mycrm/core';
import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch() * 1000)`)
};

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    domain: text('domain'),
    notes: text('notes'),
    mergedIntoAccountId: text('merged_into_account_id'),
    ...timestamps
  },
  (table) => [
    index('accounts_name_idx').on(table.name),
    index('accounts_merged_into_account_id_idx').on(table.mergedIntoAccountId)
  ]
);

export const accountAliases = sqliteTable(
  'account_aliases',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
    alias: text('alias').notNull(),
    source: text('source').notNull().default('manual'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`)
  },
  (table) => [
    uniqueIndex('account_aliases_account_alias_idx').on(table.accountId, table.alias),
    index('account_aliases_alias_idx').on(table.alias)
  ]
);

export const contacts = sqliteTable(
  'contacts',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    company: text('company'),
    position: text('position'),
    headline: text('headline'),
    profileUrl: text('profile_url'),
    linkedinProfileId: text('linkedin_profile_id'),
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    outreachStatus: text('outreach_status'),
    nextReminderAt: integer('next_reminder_at'),
    deletedAt: integer('deleted_at'),
    seniorityBucket: text('seniority_bucket'),
    buyingRole: text('buying_role'),
    relationshipStatus: text('relationship_status', { enum: relationshipStatuses }).notNull().default('new'),
    lastInteractionAt: integer('last_interaction_at'),
    lastReplyAt: integer('last_reply_at'),
    lastSentAt: integer('last_sent_at'),
    ...timestamps
  },
  (table) => [
    uniqueIndex('contacts_linkedin_profile_id_idx').on(table.linkedinProfileId),
    index('contacts_relationship_status_idx').on(table.relationshipStatus),
    index('contacts_last_interaction_at_idx').on(table.lastInteractionAt)
  ]
);

export const reminders = sqliteTable(
  'reminders',
  {
    id: text('id').primaryKey(),
    entityType: text('entity_type', { enum: reminderEntityTypes }).notNull(),
    entityId: text('entity_id').notNull(),
    status: text('status', { enum: reminderStatuses }).notNull().default('due_today'),
    ruleType: text('rule_type', { enum: reminderRuleTypes }).notNull().default('manual'),
    dueAt: integer('due_at').notNull(),
    completedAt: integer('completed_at'),
    note: text('note'),
    ...timestamps
  },
  (table) => [
    index('reminders_entity_idx').on(table.entityType, table.entityId),
    index('reminders_status_due_at_idx').on(table.status, table.dueAt)
  ]
);

export const campaigns = sqliteTable(
  'campaigns',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    objective: text('objective').notNull(),
    status: text('status', { enum: campaignStatuses }).notNull().default('draft'),
    defaultPrompt: text('default_prompt'),
    tags: text('tags').notNull().default('[]'),
    ...timestamps
  },
  (table) => [
    index('campaigns_status_idx').on(table.status),
    index('campaigns_updated_at_idx').on(table.updatedAt)
  ]
);

export const campaignTargets = sqliteTable(
  'campaign_targets',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
    contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`)
  },
  (table) => [
    uniqueIndex('campaign_targets_campaign_contact_idx').on(table.campaignId, table.contactId),
    index('campaign_targets_contact_id_idx').on(table.contactId)
  ]
);

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    linkedinThreadId: text('linkedin_thread_id').notNull(),
    lastMessageDate: integer('last_message_date'),
    lastSender: text('last_sender'),
    lastSyncedAt: integer('last_synced_at'),
    deletedAt: integer('deleted_at'),
    ...timestamps
  },
  (table) => [
    uniqueIndex('conversations_linkedin_thread_id_idx').on(table.linkedinThreadId),
    index('conversations_contact_id_idx').on(table.contactId)
  ]
);

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    linkedinMessageId: text('linkedin_message_id').notNull(),
    sender: text('sender').notNull(),
    senderType: text('sender_type').notNull(),
    content: text('content').notNull(),
    timestamp: integer('timestamp').notNull(),
    isInbound: integer('is_inbound', { mode: 'boolean' }).notNull(),
    rawPayload: text('raw_payload').notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex('messages_linkedin_message_id_idx').on(table.linkedinMessageId),
    index('messages_conversation_timestamp_idx').on(table.conversationId, table.timestamp)
  ]
);

export const drafts = sqliteTable(
  'drafts',
  {
    id: text('id').primaryKey(),
    contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    goalText: text('goal_text').notNull(),
    approvedText: text('approved_text'),
    draftStatus: text('draft_status', { enum: draftStatuses }).notNull().default('none'),
    sendStatus: text('send_status', { enum: sendStatuses }).notNull().default('idle'),
    modelName: text('model_name'),
    approvedAt: integer('approved_at'),
    sentAt: integer('sent_at'),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`)
  },
  (table) => [
    index('drafts_contact_id_idx').on(table.contactId),
    index('drafts_conversation_id_idx').on(table.conversationId)
  ]
);

export const draftVariants = sqliteTable(
  'draft_variants',
  {
    id: text('id').primaryKey(),
    draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
    variantIndex: integer('variant_index').notNull(),
    text: text('text').notNull(),
    selected: integer('selected', { mode: 'boolean' }).notNull().default(false),
    score: integer('score')
  },
  (table) => [uniqueIndex('draft_variants_draft_variant_idx').on(table.draftId, table.variantIndex)]
);

export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    type: text('type', { enum: jobTypes }).notNull(),
    payload: text('payload').notNull(),
    status: text('status', { enum: jobStatuses }).notNull().default('queued'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lockedAt: integer('locked_at'),
    lastError: text('last_error'),
    scheduledFor: integer('scheduled_for'),
    ...timestamps
  },
  (table) => [index('jobs_status_scheduled_for_idx').on(table.status, table.scheduledFor)]
);

export const syncRuns = sqliteTable('sync_runs', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  status: text('status', { enum: syncRunStatuses }).notNull().default('running'),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
  itemsScanned: integer('items_scanned').notNull().default(0),
  itemsImported: integer('items_imported').notNull().default(0),
  error: text('error')
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  isSecret: integer('is_secret', { mode: 'boolean' }).notNull().default(false)
});

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  payload: text('payload').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`)
});

export const syncSuppressions = sqliteTable(
  'sync_suppressions',
  {
    id: text('id').primaryKey(),
    contactId: text('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),
    linkedinProfileId: text('linkedin_profile_id').notNull(),
    reason: text('reason'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
    deletedAt: integer('deleted_at')
  },
  (table) => [
    uniqueIndex('sync_suppressions_linkedin_profile_id_idx').on(table.linkedinProfileId),
    index('sync_suppressions_contact_id_idx').on(table.contactId)
  ]
);

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  mergedInto: one(accounts, {
    fields: [accounts.mergedIntoAccountId],
    references: [accounts.id]
  }),
  aliases: many(accountAliases),
  contacts: many(contacts)
}));

export const accountAliasesRelations = relations(accountAliases, ({ one }) => ({
  account: one(accounts, {
    fields: [accountAliases.accountId],
    references: [accounts.id]
  })
}));

export const contactsRelations = relations(contacts, ({ many }) => ({
  conversations: many(conversations),
  drafts: many(drafts),
  campaignTargets: many(campaignTargets),
  suppressions: many(syncSuppressions)
}));

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  targets: many(campaignTargets)
}));

export const campaignTargetsRelations = relations(campaignTargets, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignTargets.campaignId],
    references: [campaigns.id]
  }),
  contact: one(contacts, {
    fields: [campaignTargets.contactId],
    references: [contacts.id]
  })
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [conversations.contactId],
    references: [contacts.id]
  }),
  messages: many(messages),
  drafts: many(drafts)
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  })
}));

export const draftsRelations = relations(drafts, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [drafts.contactId],
    references: [contacts.id]
  }),
  conversation: one(conversations, {
    fields: [drafts.conversationId],
    references: [conversations.id]
  }),
  variants: many(draftVariants)
}));

export const draftVariantsRelations = relations(draftVariants, ({ one }) => ({
  draft: one(drafts, {
    fields: [draftVariants.draftId],
    references: [drafts.id]
  })
}));

export const allTables = {
  accounts,
  accountAliases,
  campaigns,
  campaignTargets,
  contacts,
  conversations,
  messages,
  drafts,
  draftVariants,
  jobs,
  syncRuns,
  settings,
  syncSuppressions,
  auditLog
};
