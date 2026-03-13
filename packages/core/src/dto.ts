import { z } from 'zod';
import {
  draftStatusSchema,
  jobStatusSchema,
  jobTypeSchema,
  relationshipStatusSchema,
  sendStatusSchema
} from './statuses';

export const inboxItemSchema = z.object({
  contactId: z.string().min(1),
  conversationId: z.string().min(1),
  contactName: z.string().min(1),
  company: z.string().nullable(),
  headline: z.string().nullable(),
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

export const importThreadsResultSchema = z.object({
  provider: z.string().min(1),
  accountId: z.string().min(1),
  itemsScanned: z.number().int().nonnegative(),
  itemsImported: z.number().int().nonnegative(),
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
export type UpdateRelationshipStatusInput = z.infer<typeof updateRelationshipStatusInputSchema>;
export type ApproveDraftInput = z.infer<typeof approveDraftInputSchema>;
export type GenerateDraftInput = z.infer<typeof generateDraftInputSchema>;
export type GeneratedDraftVariantDto = z.infer<typeof generatedDraftVariantSchema>;
export type GeneratedDraftResultDto = z.infer<typeof generatedDraftResultSchema>;
export type JobDto = z.infer<typeof jobDtoSchema>;
export type AuditLogEntryDto = z.infer<typeof auditLogEntrySchema>;
export type JobWithAuditDto = z.infer<typeof jobWithAuditSchema>;
export type EnqueueJobInput = z.infer<typeof enqueueJobInputSchema>;
export type EnqueueJobResultDto = z.infer<typeof enqueueJobResultSchema>;
export type MutationResultDto = z.infer<typeof mutationResultSchema>;
export type ImportThreadsPayload = z.infer<typeof importThreadsPayloadSchema>;
export type ImportThreadsResultDto = z.infer<typeof importThreadsResultSchema>;
export type SyncRunDto = z.infer<typeof syncRunDtoSchema>;
export type ManualSyncRequest = z.infer<typeof manualSyncRequestSchema>;