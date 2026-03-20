import { z } from 'zod';
import {
  campaignStatusSchema,
  draftStatusSchema,
  jobStatusSchema,
  jobTypeSchema,
  reminderEntityTypeSchema,
  reminderRuleTypeSchema,
  reminderStatusSchema,
  relationshipStatusSchema,
  sendStatusSchema
} from './statuses';

export const inboxItemSchema = z.object({
  contactId: z.string().min(1),
  conversationId: z.string().min(1),
  contactName: z.string().min(1),
  company: z.string().nullable(),
  headline: z.string().nullable(),
  accountId: z.string().nullable().optional(),
  outreachStatus: z.string().nullable().optional(),
  nextReminderAt: z.number().int().nullable().optional(),
  seniorityBucket: z.string().nullable().optional(),
  buyingRole: z.string().nullable().optional(),
  relationshipStatus: relationshipStatusSchema,
  draftStatus: draftStatusSchema,
  sendStatus: sendStatusSchema,
  lastMessageAt: z.number().int().nullable(),
  lastMessageText: z.string().nullable(),
  lastSender: z.string().nullable(),
  unreadCount: z.number().int().nonnegative()
});

export const messageDtoSchema = z.object({
  id: z.string().min(1),
  linkedinMessageId: z.string().min(1),
  sender: z.string().min(1),
  senderType: z.string().min(1),
  content: z.string().min(1),
  timestamp: z.number().int(),
  isInbound: z.boolean()
});

export const draftSummarySchema = z.object({
  id: z.string().min(1),
  goalText: z.string().min(1),
  approvedText: z.string().nullable(),
  draftStatus: draftStatusSchema,
  sendStatus: sendStatusSchema,
  modelName: z.string().nullable(),
  approvedAt: z.number().int().nullable(),
  sentAt: z.number().int().nullable(),
  createdAt: z.number().int()
});

export const contactConversationDetailsSchema = z.object({
  contact: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    company: z.string().nullable(),
    position: z.string().nullable(),
    headline: z.string().nullable(),
    profileUrl: z.string().nullable(),
    accountId: z.string().nullable().optional(),
    outreachStatus: z.string().nullable().optional(),
    nextReminderAt: z.number().int().nullable().optional(),
    seniorityBucket: z.string().nullable().optional(),
    buyingRole: z.string().nullable().optional(),
    relationshipStatus: relationshipStatusSchema,
    lastInteractionAt: z.number().int().nullable(),
    lastReplyAt: z.number().int().nullable(),
    lastSentAt: z.number().int().nullable()
  }),
  conversation: z.object({
    id: z.string().min(1),
    linkedinThreadId: z.string().min(1),
    lastMessageDate: z.number().int().nullable(),
    lastSender: z.string().nullable(),
    lastSyncedAt: z.number().int().nullable()
  }),
  messages: z.array(messageDtoSchema),
  drafts: z.array(draftSummarySchema)
});

export const accountAliasSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  alias: z.string().min(1),
  source: z.string().min(1),
  createdAt: z.number().int()
});

export const accountSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  domain: z.string().nullable(),
  notes: z.string().nullable(),
  contactCount: z.number().int().nonnegative(),
  aliasCount: z.number().int().nonnegative(),
  createdAt: z.number().int(),
  updatedAt: z.number().int()
});

export const accountDetailSchema = z.object({
  account: accountSummarySchema.extend({
    aliases: z.array(accountAliasSchema)
  }),
  contacts: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      company: z.string().nullable(),
      position: z.string().nullable(),
      headline: z.string().nullable(),
      seniorityBucket: z.string().nullable(),
      buyingRole: z.string().nullable(),
      relationshipStatus: relationshipStatusSchema,
      lastInteractionAt: z.number().int().nullable()
    })
  )
});

export const reminderSchema = z.object({
  id: z.string().min(1),
  entityType: reminderEntityTypeSchema,
  entityId: z.string().min(1),
  status: reminderStatusSchema,
  ruleType: reminderRuleTypeSchema,
  dueAt: z.number().int(),
  completedAt: z.number().int().nullable(),
  note: z.string().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int()
});

export const campaignSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  objective: z.string().min(1),
  status: campaignStatusSchema,
  defaultPrompt: z.string().nullable(),
  tags: z.array(z.string().min(1)),
  targetCount: z.number().int().nonnegative(),
  draftCount: z.number().int().nonnegative(),
  reminderCount: z.number().int().nonnegative(),
  lastActivityAt: z.number().int().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int()
});

export const campaignTargetSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  contactId: z.string().min(1),
  createdAt: z.number().int(),
  contact: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    company: z.string().nullable(),
    headline: z.string().nullable(),
    relationshipStatus: relationshipStatusSchema,
    nextReminderAt: z.number().int().nullable(),
    lastInteractionAt: z.number().int().nullable()
  })
});

export const campaignActivityItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['draft', 'reminder', 'audit']),
  label: z.string().min(1),
  timestamp: z.number().int(),
  status: z.string().nullable(),
  entityId: z.string().min(1)
});

export const campaignDetailSchema = z.object({
  campaign: campaignSummarySchema.extend({
    defaultPrompt: z.string().nullable(),
    tags: z.array(z.string().min(1))
  }),
  targets: z.array(campaignTargetSchema),
  drafts: z.array(draftSummarySchema),
  reminders: z.array(reminderSchema),
  activity: z.array(campaignActivityItemSchema)
});

export const createCampaignInputSchema = z.object({
  name: z.string().min(1).max(200),
  objective: z.string().min(1).max(500),
  status: campaignStatusSchema.default('draft'),
  defaultPrompt: z.string().max(4000).optional().default(''),
  tags: z.array(z.string().min(1).max(50)).optional().default([])
});

export const updateCampaignInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  objective: z.string().min(1).max(500).optional(),
  status: campaignStatusSchema.optional(),
  defaultPrompt: z.string().max(4000).optional(),
  tags: z.array(z.string().min(1).max(50)).optional()
});

export const addCampaignTargetsInputSchema = z.object({
  contactIds: z.array(z.string().min(1)).min(1)
});

export const createReminderInputSchema = z.object({
  entityType: reminderEntityTypeSchema,
  entityId: z.string().min(1),
  ruleType: reminderRuleTypeSchema.default('manual'),
  dueAt: z.number().int(),
  note: z.string().max(1000).optional().default('')
});

export const updateReminderInputSchema = z.object({
  dueAt: z.number().int().optional(),
  note: z.string().max(1000).optional(),
  status: reminderStatusSchema.optional(),
  completedAt: z.number().int().nullable().optional()
});

export const createAccountInputSchema = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().max(200).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
  alias: z.string().max(200).optional().default('')
});

export const assignContactsToAccountInputSchema = z.object({
  contactIds: z.array(z.string().min(1)).min(1)
});

export const mergeAccountsInputSchema = z.object({
  sourceAccountId: z.string().min(1),
  targetAccountId: z.string().min(1),
  preserveSourceAsAlias: z.boolean().default(true)
});

export const updateRelationshipStatusInputSchema = z.object({
  relationshipStatus: relationshipStatusSchema
});

export const approveDraftInputSchema = z.object({
  approvedText: z.string().min(1),
  sendStatus: sendStatusSchema.default('idle')
});

export const generateDraftInputSchema = z.object({
  contactId: z.string().min(1),
  conversationId: z.string().min(1),
  goal: z.string().min(1).max(500)
});

export const bulkDraftGenerationOptionsSchema = z.object({
  includeLink: z.string().max(500).optional().default(''),
  callToAction: z.string().max(280).optional().default(''),
  tone: z.string().max(120).optional().default(''),
  constraints: z.string().max(1000).optional().default(''),
  useRecentConversationContext: z.boolean().default(true),
  useAccountContext: z.boolean().default(true),
  varyMessageByRole: z.boolean().default(true),
  avoidRepeatingAngleWithinAccount: z.boolean().default(true)
});

export const bulkGenerateDraftInputSchema = z.object({
  selections: z.array(
    z.object({
      contactId: z.string().min(1),
      conversationId: z.string().min(1)
    })
  ).min(1),
  goal: z.string().min(1).max(500),
  options: bulkDraftGenerationOptionsSchema
});

export const generatedDraftVariantSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  selected: z.boolean(),
  score: z.number().int().nullable()
});

export const generatedDraftResultSchema = z.object({
  draftId: z.string().min(1),
  contactId: z.string().min(1),
  conversationId: z.string().min(1),
  goalText: z.string().min(1),
  draftStatus: draftStatusSchema,
  modelName: z.string().min(1),
  variants: z.array(generatedDraftVariantSchema).min(1)
});

export const bulkGeneratedDraftItemSchema = z.object({
  contactId: z.string().min(1),
  conversationId: z.string().min(1),
  draft: generatedDraftResultSchema
});

export const bulkGeneratedDraftResultSchema = z.object({
  requestedCount: z.number().int().positive(),
  generatedCount: z.number().int().nonnegative(),
  drafts: z.array(bulkGeneratedDraftItemSchema),
  goal: z.string().min(1),
  options: bulkDraftGenerationOptionsSchema
});

export const jobDtoSchema = z.object({
  id: z.string().min(1),
  type: jobTypeSchema,
  status: jobStatusSchema,
  payload: z.string().min(1),
  attemptCount: z.number().int().nonnegative(),
  lockedAt: z.number().int().nullable(),
  lastError: z.string().nullable(),
  scheduledFor: z.number().int().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int()
});

export const auditLogEntrySchema = z.object({
  id: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  action: z.string().min(1),
  payload: z.string().min(1),
  createdAt: z.number().int()
});

export const jobWithAuditSchema = z.object({
  job: jobDtoSchema,
  auditEntries: z.array(auditLogEntrySchema)
});

export const suppressionSchema = z.object({
  id: z.string().min(1),
  contactId: z.string().min(1).nullable().optional(),
  linkedinProfileId: z.string().min(1),
  reason: z.string().nullable().optional(),
  createdAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional()
});

export const createSuppressionInputSchema = z.object({
  contactId: z.string().min(1).optional(),
  linkedinProfileId: z.string().min(1),
  reason: z.string().max(1000).optional().default('')
});

export const restoreSuppressionInputSchema = z.object({
  suppressionId: z.string().min(1)
});

export const enqueueJobInputSchema = z.object({
  type: jobTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  scheduledFor: z.number().int().nullable().optional()
});

export const enqueueJobResultSchema = z.object({
  jobId: z.string().min(1),
  status: jobStatusSchema
});

export const mutationResultSchema = z.object({
  success: z.literal(true)
});

export const importThreadsPayloadSchema = z.object({
  provider: z.string().min(1).default('fake-linkedin'),
  accountId: z.string().min(1).default('local-account')
});

export const manualSyncRequestSchema = z.object({
  accountId: z.string().min(1).default('local-account'),
  provider: z.string().min(1).default('linkedin-browser')
});

export const queueSendRequestSchema = z.object({
  draftId: z.string().min(1),
  conversationId: z.string().min(1),
  accountId: z.string().min(1).default('local-account'),
  provider: z.string().min(1).default('linkedin-browser')
});

export const sendMessagePayloadSchema = z.object({
  draftId: z.string().min(1),
  conversationId: z.string().min(1),
  accountId: z.string().min(1),
  provider: z.string().min(1).default('linkedin-browser'),
  messageText: z.string().min(1)
});

export const sendMessageResultSchema = z.object({
  provider: z.string().min(1),
  accountId: z.string().min(1),
  draftId: z.string().min(1),
  conversationId: z.string().min(1),
  sentAt: z.number().int().positive()
});

export const browserSessionSchema = z.object({
  accountId: z.string().min(1),
  cookiesJson: z.string().min(1),
  userAgent: z.string().min(1),
  capturedAt: z.number().int().positive().optional()
});

export const linkedinSyncReadinessSchema = z.object({
  accountId: z.string().min(1),
  ready: z.boolean(),
  reason: z.enum([
    'ready',
    'feature_disabled',
    'cdp_unreachable',
    'cdp_configured',
    'profile_configured',
    'session_available',
    'credentials_configured',
    'browser_session_missing'
  ]),
  message: z.string().min(1),
  checks: z.object({
    enableRealBrowserSync: z.boolean(),
    hasCdpUrl: z.boolean(),
    cdpReachable: z.boolean(),
    hasUserDataDir: z.boolean(),
    hasSavedSession: z.boolean(),
    hasLinkedinCredentials: z.boolean()
  })
});

export const browserSessionBootstrapRequestSchema = z.object({
  accountId: z.string().min(1).default('local-account')
});

export const browserSessionBootstrapResultSchema = z.object({
  accountId: z.string().min(1),
  capturedAt: z.number().int().positive(),
  userAgent: z.string().min(1),
  readiness: linkedinSyncReadinessSchema
});

export const settingKeySchema = z.enum([
  'default_account_id',
  'followup_days',
  'gemini_model',
  'enable_ai',
  'enable_automation',
  'enable_real_browser_sync',
  'enable_real_send',
  'gemini_api_key',
  'linkedin_session_token'
]);

export const settingValueSchema = z.object({
  key: settingKeySchema,
  value: z.string(),
  isSecret: z.boolean(),
  updatedAt: z.number().int().nullable().optional(),
  redactedValue: z.string().nullable().optional()
});

export const settingsSnapshotSchema = z.object({
  values: z.array(settingValueSchema),
  exportedAt: z.number().int(),
  version: z.literal(1)
});

export const workspaceBackupDataSchema = z.object({
  accounts: z.array(z.record(z.string(), z.unknown())),
  accountAliases: z.array(z.record(z.string(), z.unknown())),
  campaigns: z.array(z.record(z.string(), z.unknown())),
  campaignTargets: z.array(z.record(z.string(), z.unknown())),
  reminders: z.array(z.record(z.string(), z.unknown())),
  contacts: z.array(z.record(z.string(), z.unknown())),
  conversations: z.array(z.record(z.string(), z.unknown())),
  messages: z.array(z.record(z.string(), z.unknown())),
  drafts: z.array(z.record(z.string(), z.unknown())),
  draftVariants: z.array(z.record(z.string(), z.unknown())),
  jobs: z.array(z.record(z.string(), z.unknown())),
  syncRuns: z.array(z.record(z.string(), z.unknown())),
  syncSuppressions: z.array(z.record(z.string(), z.unknown())),
  auditLog: z.array(z.record(z.string(), z.unknown()))
});

export const workspaceBackupSnapshotSchema = z.object({
  version: z.literal(1),
  scope: z.literal('workspace'),
  exportedAt: z.number().int(),
  settings: z.array(settingValueSchema),
  data: workspaceBackupDataSchema
});

export const updateSettingsInputSchema = z.object({
  values: z.array(
    z.object({
      key: settingKeySchema,
      value: z.string(),
      isSecret: z.boolean().optional(),
      reset: z.boolean().optional().default(false)
    })
  ).min(1)
});

export const backupExportQuerySchema = z.object({
  includeSecrets: z.boolean().default(false),
  scope: z.enum(['settings', 'workspace']).default('settings')
});

export const restoreImportInputSchema = z.object({
  version: z.literal(1),
  values: z.array(settingValueSchema.pick({ key: true, value: true, isSecret: true })).min(1),
  mode: z.enum(['merge', 'replace']).default('merge')
}).superRefine((input, context) => {
  const seen = new Set<string>();

  for (const entry of input.values) {
    if (seen.has(entry.key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate setting key: ${entry.key}`,
        path: ['values']
      });
    }

    seen.add(entry.key);

    if (entry.isSecret && entry.value.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Secret setting ${entry.key} cannot be empty during import`,
        path: ['values']
      });
    }
  }
});

export const restoreWorkspaceInputSchema = z.object({
  version: z.literal(1),
  scope: z.literal('workspace'),
  mode: z.enum(['merge', 'replace']).default('replace'),
  settings: z.array(settingValueSchema.pick({ key: true, value: true, isSecret: true })).min(1),
  data: workspaceBackupDataSchema
}).superRefine((input, context) => {
  const seen = new Set<string>();

  for (const entry of input.settings) {
    if (seen.has(entry.key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate setting key: ${entry.key}`,
        path: ['settings']
      });
    }

    seen.add(entry.key);

    if (entry.isSecret && entry.value.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Secret setting ${entry.key} cannot be empty during import`,
        path: ['settings']
      });
    }
  }
});

export const importThreadsResultSchema = z.object({
  provider: z.string().min(1),
  accountId: z.string().min(1),
  itemsScanned: z.number().int().nonnegative(),
  itemsImported: z.number().int().nonnegative(),
  messagesImported: z.number().int().nonnegative().optional(),
  threadIds: z.array(z.string().min(1))
});

export const syncRunDtoSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  status: z.string().min(1),
  startedAt: z.number().int(),
  finishedAt: z.number().int().nullable(),
  itemsScanned: z.number().int().nonnegative(),
  itemsImported: z.number().int().nonnegative(),
  error: z.string().nullable()
});

export type InboxItemDto = z.infer<typeof inboxItemSchema>;
export type MessageDto = z.infer<typeof messageDtoSchema>;
export type DraftSummaryDto = z.infer<typeof draftSummarySchema>;
export type ContactConversationDetailsDto = z.infer<typeof contactConversationDetailsSchema>;
export type AccountAliasDto = z.infer<typeof accountAliasSchema>;
export type AccountSummaryDto = z.infer<typeof accountSummarySchema>;
export type AccountDetailDto = z.infer<typeof accountDetailSchema>;
export type CampaignSummaryDto = z.infer<typeof campaignSummarySchema>;
export type CampaignTargetDto = z.infer<typeof campaignTargetSchema>;
export type CampaignActivityItemDto = z.infer<typeof campaignActivityItemSchema>;
export type CampaignDetailDto = z.infer<typeof campaignDetailSchema>;
export type ReminderDto = z.infer<typeof reminderSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignInputSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignInputSchema>;
export type AddCampaignTargetsInput = z.infer<typeof addCampaignTargetsInputSchema>;
export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;
export type AssignContactsToAccountInput = z.infer<typeof assignContactsToAccountInputSchema>;
export type MergeAccountsInput = z.infer<typeof mergeAccountsInputSchema>;
export type CreateReminderInput = z.infer<typeof createReminderInputSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderInputSchema>;
export type UpdateRelationshipStatusInput = z.infer<typeof updateRelationshipStatusInputSchema>;
export type ApproveDraftInput = z.infer<typeof approveDraftInputSchema>;
export type GenerateDraftInput = z.infer<typeof generateDraftInputSchema>;
export type GeneratedDraftVariantDto = z.infer<typeof generatedDraftVariantSchema>;
export type GeneratedDraftResultDto = z.infer<typeof generatedDraftResultSchema>;
export type JobDto = z.infer<typeof jobDtoSchema>;
export type AuditLogEntryDto = z.infer<typeof auditLogEntrySchema>;
export type JobWithAuditDto = z.infer<typeof jobWithAuditSchema>;
export type SuppressionDto = z.infer<typeof suppressionSchema>;
export type CreateSuppressionInput = z.infer<typeof createSuppressionInputSchema>;
export type RestoreSuppressionInput = z.infer<typeof restoreSuppressionInputSchema>;
export type EnqueueJobInput = z.infer<typeof enqueueJobInputSchema>;
export type EnqueueJobResultDto = z.infer<typeof enqueueJobResultSchema>;
export type MutationResultDto = z.infer<typeof mutationResultSchema>;
export type ImportThreadsPayload = z.infer<typeof importThreadsPayloadSchema>;
export type ImportThreadsResultDto = z.infer<typeof importThreadsResultSchema>;
export type SyncRunDto = z.infer<typeof syncRunDtoSchema>;
export type ManualSyncRequest = z.infer<typeof manualSyncRequestSchema>;
export type BrowserSessionInput = z.infer<typeof browserSessionSchema>;
export type LinkedInSyncReadinessDto = z.infer<typeof linkedinSyncReadinessSchema>;
export type QueueSendRequest = z.infer<typeof queueSendRequestSchema>;
export type SendMessagePayload = z.infer<typeof sendMessagePayloadSchema>;
export type SendMessageResultDto = z.infer<typeof sendMessageResultSchema>;
export type SettingKey = z.infer<typeof settingKeySchema>;
export type SettingValueDto = z.infer<typeof settingValueSchema>;
export type SettingsSnapshotDto = z.infer<typeof settingsSnapshotSchema>;
export type WorkspaceBackupDataDto = z.infer<typeof workspaceBackupDataSchema>;
export type WorkspaceBackupSnapshotDto = z.infer<typeof workspaceBackupSnapshotSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;
export type BackupExportQuery = z.infer<typeof backupExportQuerySchema>;
export type RestoreImportInput = z.infer<typeof restoreImportInputSchema>;
export type RestoreWorkspaceInput = z.infer<typeof restoreWorkspaceInputSchema>;