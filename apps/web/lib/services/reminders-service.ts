import {
  createReminderInputSchema,
  NotFoundError,
  reminderSchema,
  updateReminderInputSchema,
  ValidationError
} from '@mycrm/core';
import { createNodeDb, createReminderRepository, getDb } from '@mycrm/db/server';

async function getServiceDb(databaseUrl?: string) {
  if (databaseUrl) {
    return createNodeDb(databaseUrl);
  }

  return getDb();
}

export async function listReminders(
  input?: { entityType?: 'contact' | 'account' | 'campaign'; entityId?: string },
  databaseUrl?: string
) {
  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createReminderRepository(db, sqlite);
  const reminders = await repository.listReminders(input);
  return reminderSchema.array().parse(reminders);
}

export async function createReminder(input: unknown, databaseUrl?: string) {
  const parsed = createReminderInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid reminder payload', parsed.error.flatten());
  }

  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createReminderRepository(db, sqlite);
  const reminder = await repository.upsertReminder(parsed.data);

  if (!reminder) {
    throw new Error('Reminder was not created');
  }

  return reminderSchema.parse(reminder);
}

export async function updateReminder(reminderId: string, input: unknown, databaseUrl?: string) {
  if (!reminderId) {
    throw new ValidationError('reminderId is required');
  }

  const parsed = updateReminderInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid reminder payload', parsed.error.flatten());
  }

  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createReminderRepository(db, sqlite);
  const reminder = await repository.updateReminder(reminderId, parsed.data);

  if (!reminder) {
    throw new NotFoundError(`Reminder ${reminderId} was not found`, { reminderId });
  }

  return reminderSchema.parse(reminder);
}