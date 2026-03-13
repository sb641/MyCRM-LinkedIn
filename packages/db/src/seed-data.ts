import type {
  DraftStatus,
  JobStatus,
  JobType,
  RelationshipStatus,
  SendStatus,
  SyncRunStatus
} from '@mycrm/core';

const now = Date.UTC(2026, 2, 13, 9, 0, 0);

function makeId(prefix: string, index: number) {
  return `${prefix}-${String(index).padStart(3, '0')}`;
}

export function buildSeedData() {
  const contacts = Array.from({ length: 20 }, (_, index) => {
    const relationshipStatus: RelationshipStatus =
      index % 5 === 0 ? 'followup_due' : index % 4 === 0 ? 'awaiting_reply' : index % 3 === 0 ? 'replied' : 'new';
    const timestamp = now - index * 86_400_000;

    return {
      id: makeId('contact', index + 1),
      name: `Contact ${index + 1}`,
      company: `Company ${((index % 6) + 1).toString()}`,
      position: `Role ${((index % 4) + 1).toString()}`,
      headline: `Role ${((index % 4) + 1).toString()} at Company ${((index % 6) + 1).toString()}`,
      profileUrl: `https://linkedin.com/in/contact-${index + 1}`,
      linkedinProfileId: `linkedin-profile-${index + 1}`,
      relationshipStatus,
      lastInteractionAt: timestamp,
      lastReplyAt: relationshipStatus === 'replied' ? timestamp : null,
      lastSentAt: relationshipStatus === 'new' ? null : timestamp - 3_600_000,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  });

  const conversations = Array.from({ length: 10 }, (_, index) => {
    const timestamp = now - index * 43_200_000;
    return {
      id: makeId('conversation', index + 1),
      contactId: contacts[index].id,
      linkedinThreadId: `thread-${index + 1}`,
      lastMessageDate: timestamp,
      lastSender: index % 2 === 0 ? 'contact' : 'me',
      lastSyncedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  });

  const messages = conversations.flatMap((conversation, conversationIndex) =>
    Array.from({ length: 10 }, (_, messageIndex) => {
      const timestamp = now - conversationIndex * 43_200_000 - messageIndex * 3_600_000;
      const inbound = messageIndex % 2 === 0;
      return {
        id: makeId(`message-${conversationIndex + 1}`, messageIndex + 1),
        conversationId: conversation.id,
        linkedinMessageId: `linkedin-message-${conversationIndex + 1}-${messageIndex + 1}`,
        sender: inbound ? contacts[conversationIndex].name : 'Me',
        senderType: inbound ? 'contact' : 'me',
        content: `Sample message ${messageIndex + 1} in ${conversation.id}`,
        timestamp,
        isInbound: inbound,
        rawPayload: JSON.stringify({ conversationId: conversation.id, messageIndex: messageIndex + 1 }),
        createdAt: timestamp,
        updatedAt: timestamp
      };
    })
  );

  const drafts = conversations.slice(0, 4).map((conversation, index) => {
    const draftStatus: DraftStatus = index % 2 === 0 ? 'approved' : 'generated';
    const sendStatus: SendStatus = index === 0 ? 'sent' : index === 1 ? 'queued' : 'idle';
    const timestamp = now - index * 21_600_000;
    return {
      id: makeId('draft', index + 1),
      contactId: conversation.contactId,
      conversationId: conversation.id,
      goalText: `Follow up goal ${index + 1}`,
      approvedText: draftStatus === 'approved' ? `Approved draft ${index + 1}` : null,
      draftStatus,
      sendStatus,
      modelName: 'mock-gemini',
      approvedAt: draftStatus === 'approved' ? timestamp : null,
      sentAt: sendStatus === 'sent' ? timestamp + 3_600_000 : null,
      createdAt: timestamp
    };
  });

  const draftVariants = drafts.flatMap((draft, index) =>
    Array.from({ length: 3 }, (_, variantIndex) => ({
      id: makeId(`variant-${index + 1}`, variantIndex + 1),
      draftId: draft.id,
      variantIndex,
      text: `Draft ${index + 1} variant ${variantIndex + 1}`,
      selected: variantIndex === 0,
      score: 90 - variantIndex * 5
    }))
  );

  const jobs = Array.from({ length: 3 }, (_, index) => {
    const status: JobStatus = index === 0 ? 'queued' : index === 1 ? 'running' : 'failed';
    const type: JobType = index === 0 ? 'generate_draft' : index === 1 ? 'import_threads' : 'send_message';
    const timestamp = now - index * 7_200_000;
    return {
      id: makeId('job', index + 1),
      type,
      payload: JSON.stringify({ index: index + 1 }),
      status,
      attemptCount: index,
      lockedAt: status === 'running' ? timestamp : null,
      lastError: status === 'failed' ? 'Simulated failure' : null,
      scheduledFor: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  });

  const syncRuns = Array.from({ length: 2 }, (_, index) => {
    const status: SyncRunStatus = index === 0 ? 'succeeded' : 'failed';
    const timestamp = now - index * 10_800_000;
    return {
      id: makeId('sync', index + 1),
      provider: 'mock-provider',
      status,
      startedAt: timestamp,
      finishedAt: timestamp + 60_000,
      itemsScanned: 10 + index,
      itemsImported: status === 'succeeded' ? 8 : 4,
      error: status === 'failed' ? 'Partial import failure' : null
    };
  });

  const settings = [
    { key: 'followup_days', value: '7', isSecret: false },
    { key: 'gemini_api_key', value: 'local-dev-key', isSecret: true }
  ];

  const auditLog = Array.from({ length: 6 }, (_, index) => ({
    id: makeId('audit', index + 1),
    entityType: index % 2 === 0 ? 'draft' : 'job',
    entityId: index % 2 === 0 ? drafts[index % drafts.length].id : jobs[index % jobs.length].id,
    action: index % 2 === 0 ? 'draft.created' : 'job.updated',
    payload: JSON.stringify({ index: index + 1 }),
    createdAt: now - index * 1_800_000
  }));

  return {
    contacts,
    conversations,
    messages,
    drafts,
    draftVariants,
    jobs,
    syncRuns,
    settings,
    auditLog
  };
}
