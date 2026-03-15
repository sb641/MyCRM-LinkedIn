import {
  contactConversationDetailsSchema,
  inboxItemSchema,
  NotFoundError
} from '@mycrm/core';
import { createContactRepository, createInboxRepository, createNodeDb, getDb } from '@mycrm/db/server';

async function getServiceDb(databaseUrl?: string) {
  if (databaseUrl) {
    return createNodeDb(databaseUrl);
  }

  return getDb();
}

export async function listInboxItems(databaseUrl?: string) {
  const { db, sqlite } = await getServiceDb(databaseUrl);

  try {
    const repository = createInboxRepository(db, sqlite);
    const items = await repository.listInbox();
    return inboxItemSchema.array().parse(items);
  } finally {
  }
}

export async function getContactConversationDetails(contactId: string, databaseUrl?: string) {
  const { db, sqlite } = await getServiceDb(databaseUrl);

  try {
    const repository = createContactRepository(db, sqlite);
    const details = await repository.findContactConversationDetails(contactId);

    if (!details) {
      throw new NotFoundError(`Contact ${contactId} was not found`, { contactId });
    }

    return contactConversationDetailsSchema.parse(details);
  } finally {
  }
}