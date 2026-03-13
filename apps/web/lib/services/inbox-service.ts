import {
  contactConversationDetailsSchema,
  inboxItemSchema,
  NotFoundError
} from '@mycrm/core';
import { createDb, createContactRepository, createInboxRepository } from '@mycrm/db';

export async function listInboxItems(databaseUrl?: string) {
  const { db, sqlite } = await createDb(databaseUrl);

  try {
    const repository = createInboxRepository(db, sqlite);
    const items = await repository.listInbox();
    return inboxItemSchema.array().parse(items);
  } finally {
    await sqlite.close();
  }
}

export async function getContactConversationDetails(contactId: string, databaseUrl?: string) {
  const { db, sqlite } = await createDb(databaseUrl);

  try {
    const repository = createContactRepository(db, sqlite);
    const details = await repository.findContactConversationDetails(contactId);

    if (!details) {
      throw new NotFoundError(`Contact ${contactId} was not found`, { contactId });
    }

    return contactConversationDetailsSchema.parse(details);
  } finally {
    await sqlite.close();
  }
}