import { z } from 'zod';

export const relationshipStatuses = [
  'new',
  'awaiting_reply',
  'replied',
  'followup_due',
  'archived'
] as const;

export const draftStatuses = [
  'none',
  'generated',
  'approved',
  'rejected'
] as const;

export const sendStatuses = [
  'idle',
  'queued',
  'sent',
  'failed',
  'cancelled'
] as const;

export const jobStatuses = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled'
] as const;

export const jobTypes = [
  'generate_draft',
  'tune_draft',
  'import_threads',
  'send_message'
] as const;

export const syncRunStatuses = ['running', 'succeeded', 'failed'] as const;

export const relationshipStatusSchema = z.enum(relationshipStatuses);
export const draftStatusSchema = z.enum(draftStatuses);
export const sendStatusSchema = z.enum(sendStatuses);
export const jobStatusSchema = z.enum(jobStatuses);
export const jobTypeSchema = z.enum(jobTypes);
export const syncRunStatusSchema = z.enum(syncRunStatuses);

export type RelationshipStatus = (typeof relationshipStatuses)[number];
export type DraftStatus = (typeof draftStatuses)[number];
export type SendStatus = (typeof sendStatuses)[number];
export type JobStatus = (typeof jobStatuses)[number];
export type JobType = (typeof jobTypes)[number];
export type SyncRunStatus = (typeof syncRunStatuses)[number];
