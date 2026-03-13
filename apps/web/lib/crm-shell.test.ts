import { describe, expect, it } from 'vitest';
import type { ContactConversationDetailsDto, InboxItemDto, JobWithAuditDto } from '@mycrm/core';
import {
  buildActiveSyncJobViewModel,
  buildBrowserSessionViewModel,
  buildConversationDetailsViewModel,
  buildInboxListItems,
  buildShellDataState,
  deriveRelationshipStatus,
  getShellRouteState
} from './crm-shell';

const inboxItem: InboxItemDto = {
  contactId: 'contact-001',
  conversationId: 'conversation-001',
  contactName: 'Contact 1',
  company: 'Company 1',
  headline: 'Founder',
  relationshipStatus: 'new',
  draftStatus: 'generated',
  sendStatus: 'idle',
  lastMessageAt: 1,
  lastMessageText: 'Hello',
  lastSender: 'contact',
  unreadCount: 0
};

const details: ContactConversationDetailsDto = {
  contact: {
    id: 'contact-001',
    name: 'Contact 1',
    company: 'Company 1',
    headline: 'Founder',
    profileUrl: 'https://linkedin.com/in/contact-1',
    relationshipStatus: 'new',
    lastInteractionAt: 1,
    lastReplyAt: null,
    lastSentAt: null
  },
  conversation: {
    id: 'conversation-001',
    linkedinThreadId: 'thread-1',
    lastMessageDate: 1,
    lastSender: 'contact',
    lastSyncedAt: 1
  },
  messages: [],
  drafts: []
};

describe('crm shell state', () => {
  it('selects the requested contact when present', () => {
    const route = getShellRouteState({ contactId: 'contact-001' }, [inboxItem]);

    expect(route.selectedContactId).toBe('contact-001');
    expect(route.selectedConversationId).toBe('conversation-001');
    expect(route.sort).toBe('recent');
  });

  it('falls back to the first inbox item when route params are missing', () => {
    const route = getShellRouteState({}, [inboxItem]);

    expect(route.selectedContactId).toBe('contact-001');
    expect(route.sort).toBe('recent');
  });

  it('accepts sort mode from route params', () => {
    const route = getShellRouteState({ sort: 'needs-attention' }, [inboxItem]);

    expect(route.sort).toBe('needs-attention');
  });

  it('returns empty view when inbox is empty', () => {
    const state = buildShellDataState({
      inbox: [],
      route: { selectedContactId: null, selectedConversationId: null, sort: 'recent' },
      details: null
    });

    expect(state.view).toBe('empty');
  });

  it('returns error view when an error message is present', () => {
    const state = buildShellDataState({
      inbox: [inboxItem],
      route: { selectedContactId: 'contact-001', selectedConversationId: 'conversation-001', sort: 'recent' },
      details,
      errorMessage: 'Inbox failed'
    });

    expect(state.view).toBe('error');
    expect(state.errorMessage).toBe('Inbox failed');
  });

  it('sorts inbox by attention priority when requested', () => {
    const sorted = buildInboxListItems(
      [
        inboxItem,
        {
          ...inboxItem,
          contactId: 'contact-002',
          conversationId: 'conversation-002',
          contactName: 'Contact 2',
          relationshipStatus: 'followup_due',
          draftStatus: 'generated',
          sendStatus: 'failed',
          unreadCount: 2,
          lastMessageAt: 2
        }
      ],
      'needs-attention'
    );

    expect(sorted[0]?.contactId).toBe('contact-002');
    expect(sorted[0]?.badges.some((badge) => badge.label === 'send failed')).toBe(true);
  });

  it('derives replied status when inbound reply is newer than outbound', () => {
    const derived = deriveRelationshipStatus({
      ...details,
      contact: {
        ...details.contact,
        relationshipStatus: 'awaiting_reply',
        lastReplyAt: 200,
        lastSentAt: 100
      }
    });

    expect(derived).toBe('replied');
  });

  it('derives overdue follow-up recommendations for awaiting reply contacts', () => {
    const viewModel = buildConversationDetailsViewModel({
      ...details,
      contact: {
        ...details.contact,
        relationshipStatus: 'awaiting_reply',
        lastInteractionAt: Date.now() - 8 * 86_400_000,
        lastReplyAt: null,
        lastSentAt: Date.now() - 8 * 86_400_000
      },
      drafts: []
    });

    expect(viewModel.contact.followupUrgency).toBe('overdue');
    expect(viewModel.contact.followupDueLabel).toBe('Follow-up overdue');
    expect(viewModel.contact.quickActions[0]?.label).toBe('Send follow-up now');
  });

  it('builds contact summary metadata for the shell', () => {
    const viewModel = buildConversationDetailsViewModel({
      ...details,
      drafts: [
        {
          id: 'draft-001',
          goalText: 'Follow up',
          approvedText: null,
          draftStatus: 'generated',
          sendStatus: 'idle',
          modelName: 'mock-gemini',
          approvedAt: null,
          sentAt: null,
          createdAt: 1
        }
      ]
    });

    expect(viewModel.contact.nextStepLabel).toBe('Review saved follow-up draft');
    expect(viewModel.contact.badges.some((badge) => badge.label === '1 drafts')).toBe(true);
    expect(viewModel.contact.followupDueLabel).toContain('Follow-up');
    expect(viewModel.drafts[0]?.statusLabel).toBe('generated');
  });

  it('builds an active sync job view model for queued import jobs', () => {
    const jobs: JobWithAuditDto[] = [
      {
        job: {
          id: 'job-001',
          type: 'import_threads',
          status: 'queued',
          payload: JSON.stringify({ accountId: 'browser-account', provider: 'linkedin-browser' }),
          attemptCount: 0,
          lockedAt: null,
          lastError: null,
          scheduledFor: null,
          createdAt: 1,
          updatedAt: 1
        },
        auditEntries: [
          {
            id: 'audit-001',
            entityType: 'job',
            entityId: 'job-001',
            action: 'job.enqueued',
            payload: '{"status":"queued"}',
            createdAt: 1
          }
        ]
      }
    ];

    const viewModel = buildActiveSyncJobViewModel(jobs);

    expect(viewModel).toMatchObject({
      id: 'job-001',
      accountId: 'browser-account',
      provider: 'linkedin-browser',
      status: 'queued',
      statusLabel: 'Queued',
      auditCount: 1
    });
  });

  it('includes active sync job state in the shell data model', () => {
    const state = buildShellDataState({
      inbox: [inboxItem],
      route: { selectedContactId: 'contact-001', selectedConversationId: 'conversation-001', sort: 'recent' },
      details,
      jobs: [
        {
          job: {
            id: 'job-001',
            type: 'import_threads',
            status: 'retry_scheduled',
            payload: JSON.stringify({ accountId: 'browser-account', provider: 'linkedin-browser' }),
            attemptCount: 1,
            lockedAt: null,
            lastError: 'No saved browser session found',
            scheduledFor: 2,
            createdAt: 1,
            updatedAt: 2
          },
          auditEntries: []
        }
      ]
    });

    expect(state.activeSyncJob?.statusLabel).toBe('Retry scheduled');
    expect(state.activeSyncJob?.lastError).toContain('No saved browser session');
    expect(state.activeSyncJob?.operatorMessage).toBe(
      'Saved browser session required. Capture or refresh a session before retrying sync.'
    );
  });

  it('builds browser session readiness metadata for the shell', () => {
    const session = buildBrowserSessionViewModel({
      accountId: 'local-account',
      capturedAt: Date.now() - 60_000,
      userAgent: 'Chrome 123'
    });

    expect(session).toMatchObject({
      accountId: 'local-account',
      statusLabel: 'Saved browser session ready',
      userAgentLabel: 'Chrome 123'
    });
    expect(session?.capturedAtLabel).toBeTruthy();
  });

  it('includes browser session state in the shell data model', () => {
    const state = buildShellDataState({
      inbox: [inboxItem],
      route: { selectedContactId: 'contact-001', selectedConversationId: 'conversation-001', sort: 'recent' },
      details,
      syncRuns: [
        {
          id: 'sync-001',
          provider: 'linkedin-browser',
          status: 'failed',
          startedAt: 1,
          finishedAt: 2,
          itemsScanned: 4,
          itemsImported: 1,
          error: 'Session expired'
        }
      ],
      browserSession: {
        accountId: 'local-account',
        capturedAt: Date.now() - 60_000,
        userAgent: 'Chrome 123'
      }
    });

    expect(state.browserSession?.accountId).toBe('local-account');
    expect(state.syncRuns[0]?.summaryLabel).toBe('1/4 imported before failure');
    expect(state.syncRuns[0]?.operatorMessage).toBe(
      'Saved browser session looks stale. Refresh the session bootstrap, then retry sync.'
    );
  });

  it('falls back to a generic operator sync message for unknown failures', () => {
    const state = buildShellDataState({
      inbox: [inboxItem],
      route: { selectedContactId: 'contact-001', selectedConversationId: 'conversation-001', sort: 'recent' },
      details,
      jobs: [
        {
          job: {
            id: 'job-002',
            type: 'import_threads',
            status: 'running',
            payload: JSON.stringify({ accountId: 'browser-account', provider: 'linkedin-browser' }),
            attemptCount: 1,
            lockedAt: null,
            lastError: 'Unexpected browser crash',
            scheduledFor: null,
            createdAt: 1,
            updatedAt: 2
          },
          auditEntries: []
        }
      ]
    });

    expect(state.activeSyncJob?.operatorMessage).toBe(
      'Browser sync needs operator attention. Review the latest worker error before retrying.'
    );
  });
});