import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ShellDataState } from '../../../lib/crm-shell';
import type { InboxWorkspaceViewModel } from '../../../lib/view-models/inbox';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InboxWorkspace } from './inbox-workspace';

vi.mock('next/navigation', () => ({
  usePathname: () => '/inbox',
  useSearchParams: () => new URLSearchParams('')
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InboxWorkspace bulk draft flow', () => {
  it('enables bulk generation after selecting people and opens the modal', () => {
    const state = buildState();
    const workspace = buildWorkspace();

    render(
      <InboxWorkspace
        state={state}
        workspace={workspace}
        flags={{
          ENABLE_AI: true,
          ENABLE_AUTOMATION: false,
          ENABLE_REAL_BROWSER_SYNC: false,
          ENABLE_REAL_SEND: false
        }}
      />
    );

    const bulkButton = screen.getByRole('button', { name: 'Bulk Generate' });
    expect((bulkButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('Select Contact 1'));

    expect((screen.getByRole('button', { name: 'Bulk Generate (1)' }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Bulk Generate (1)' }));

    expect(screen.getByRole('heading', { name: 'Generate drafts for selected people' })).toBeTruthy();
    expect(screen.getAllByText('Contact 1').length).toBeGreaterThan(0);
  });

  it('renders account workspace details in accounts mode', () => {
    const state = buildState();
    const workspace = buildAccountsWorkspace();

    render(
      <InboxWorkspace
        state={state}
        workspace={workspace}
        flags={{
          ENABLE_AI: true,
          ENABLE_AUTOMATION: false,
          ENABLE_REAL_BROWSER_SYNC: false,
          ENABLE_REAL_SEND: false
        }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Account workspace' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Acme Corp' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Stakeholders' })).toBeTruthy();
    expect(screen.getAllByText('Acme Incorporated')).toHaveLength(2);
  });

  it('creates, assigns, and merges accounts from account mode controls', async () => {
    const state = buildState();
    state.inbox = [
      {
        contactId: 'contact-003',
        conversationId: 'conversation-003',
        contactName: 'Contact 3',
        company: 'Independent',
        headline: 'Director',
        lastMessageText: 'Ping',
        relativeLastMessage: 'Today',
        badges: [],
        priorityRank: 1,
        quickActions: [],
        relationshipStatus: 'new',
        unreadCount: 0,
        draftStatus: 'none',
        nextReminderAt: null,
        outreachStatus: 'not_started',
        accountId: null,
        lastMessageAt: 1,
        lastInboundAt: null,
        lastOutboundAt: null,
        pendingDraftId: null,
        approvedDraftId: null,
        sendStatus: 'not_sent'
      }
    ] as ShellDataState['inbox'];
    const workspace = buildAccountsWorkspace();
    workspace.visibleAccounts.push({
      id: 'account-002',
      name: 'Beta Corp',
      domain: 'beta.test',
      notes: null,
      contactCount: 1,
      aliasCount: 0,
      createdAt: 1,
      updatedAt: 1,
      primaryAlias: null,
      relationshipLabel: '1 stakeholder',
      relativeUpdatedAt: 'Today',
      badges: [{ label: '1 stakeholder', tone: 'info' }]
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ account: { id: 'account-003', name: 'Gamma Corp' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ account: { name: 'Acme Corp' }, contacts: [{ id: 'contact-003' }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ account: { name: 'Acme Corp' } })
      });

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', {
      ...window.location,
      assign: vi.fn()
    });

    render(
      <InboxWorkspace
        state={state}
        workspace={workspace}
        flags={{
          ENABLE_AI: true,
          ENABLE_AUTOMATION: false,
          ENABLE_REAL_BROWSER_SYNC: false,
          ENABLE_REAL_SEND: false
        }}
      />
    );

    fireEvent.change(screen.getByLabelText('Account name'), { target: { value: 'Gamma Corp' } });
    fireEvent.change(screen.getByLabelText('Domain'), { target: { value: 'gamma.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByText('Created account Gamma Corp');

    fireEvent.click(screen.getByLabelText('Assign Contact 3'));
    fireEvent.click(screen.getByRole('button', { name: 'Assign selected' }));
    await screen.findByText('Assigned 1 stakeholders to Acme Corp');

    fireEvent.change(screen.getByLabelText('Source account'), { target: { value: 'account-002' } });
    fireEvent.click(screen.getByRole('button', { name: 'Merge into current account' }));
    await screen.findByText('Merged account-002 into Acme Corp');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        '/api/accounts',
        expect.objectContaining({ method: 'POST' })
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/accounts/account-001/contacts',
        expect.objectContaining({ method: 'POST' })
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        '/api/accounts/merge',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});

function buildState(): ShellDataState {
  return {
    view: 'ready',
    errorMessage: null,
    inbox: [],
    accounts: [],
    details: null,
    accountDetails: null,
    selectedItem: null,
    sort: 'recent',
    browserSession: null,
    settings: [],
    syncRuns: [],
    activeSyncJob: null
  };
}

function buildWorkspace(): InboxWorkspaceViewModel {
  return {
    entityMode: 'people',
    activeQueue: 'all',
    queueTabs: [
      { key: 'all', label: 'All', count: 2, isActive: true },
      { key: 'needs-reply', label: 'Needs Reply', count: 1, isActive: false }
    ],
    filterChips: [{ label: 'Sort', value: 'Recent' }],
    visibleItems: [
      {
        contactId: 'contact-001',
        conversationId: 'conversation-001',
        contactName: 'Contact 1',
        company: 'Company 1',
        headline: 'Founder',
        lastMessageText: 'Hello',
        relativeLastMessage: 'Today',
        badges: [{ label: 'Needs reply', tone: 'warning' }]
      },
      {
        contactId: 'contact-002',
        conversationId: 'conversation-002',
        contactName: 'Contact 2',
        company: 'Company 2',
        headline: 'VP Sales',
        lastMessageText: 'Checking in',
        relativeLastMessage: 'Yesterday',
        badges: [{ label: 'Draft', tone: 'accent' }]
      }
    ],
    visibleAccounts: [],
    selectedItem: {
      contactId: 'contact-001',
      conversationId: 'conversation-001'
    },
    selectedAccount: null,
    summary: {
      visibleConversations: 2,
      totalConversations: 2,
      totalAccounts: 0,
      visibleAccounts: 0,
      needsReplyCount: 1,
      draftCount: 1,
      followUpCount: 0
    },
    details: {
      contact: {
        id: 'contact-001',
        name: 'Contact 1',
        company: 'Company 1',
        headline: 'Founder',
        relationshipLabel: 'New',
        badges: [{ label: 'Needs reply', tone: 'warning' }],
        lastInteractionLabel: 'Today',
        nextStepLabel: 'Send follow-up',
        followupDueLabel: 'No due date',
        seniorityBucket: 'Executive',
        buyingRole: 'Decision maker',
        followupUrgency: 'none'
      },
      messages: [],
      drafts: []
    },
    accountDetails: null
  } as InboxWorkspaceViewModel;
}

function buildAccountsWorkspace(): InboxWorkspaceViewModel {
  return {
    entityMode: 'accounts',
    activeQueue: 'all',
    queueTabs: [{ key: 'all', label: 'All', count: 1, isActive: true }],
    filterChips: [{ label: 'View', value: 'Accounts' }],
    visibleItems: [],
    visibleAccounts: [
      {
        id: 'account-001',
        name: 'Acme Corp',
        domain: 'acme.test',
        notes: 'Priority ABM target',
        contactCount: 2,
        aliasCount: 1,
        createdAt: 1,
        updatedAt: 1,
        primaryAlias: 'Acme Incorporated',
        relationshipLabel: '2 stakeholders',
        relativeUpdatedAt: 'Today',
        badges: [{ label: '2 stakeholders', tone: 'info' }]
      }
    ],
    selectedItem: null,
    selectedAccount: {
      id: 'account-001',
      name: 'Acme Corp',
      domain: 'acme.test',
      notes: 'Priority ABM target',
      contactCount: 2,
      aliasCount: 1,
      createdAt: 1,
      updatedAt: 1,
      primaryAlias: 'Acme Incorporated',
      relationshipLabel: '2 stakeholders',
      relativeUpdatedAt: 'Today',
      badges: [{ label: '2 stakeholders', tone: 'info' }]
    },
    details: null,
    accountDetails: {
      account: {
        id: 'account-001',
        name: 'Acme Corp',
        domain: 'acme.test',
        notes: 'Priority ABM target',
        contactCount: 2,
        aliasCount: 1,
        createdAt: 1,
        updatedAt: 1,
        primaryAlias: 'Acme Incorporated',
        relationshipLabel: '2 stakeholders',
        relativeUpdatedAt: 'Today',
        badges: [{ label: '2 stakeholders', tone: 'info' }],
        aliases: [
          {
            id: 'alias-001',
            accountId: 'account-001',
            alias: 'Acme Incorporated',
            source: 'manual',
            createdAt: 1
          }
        ]
      },
      contacts: [
        {
          id: 'contact-001',
          name: 'Contact 1',
          company: 'Acme Corp',
          position: 'Founder',
          headline: 'Founder',
          seniorityBucket: 'Executive',
          buyingRole: 'Decision maker',
          relationshipStatus: 'awaiting_reply',
          lastInteractionAt: 1,
          relationshipLabel: 'awaiting reply',
          relativeLastInteraction: 'Today'
        },
        {
          id: 'contact-002',
          name: 'Contact 2',
          company: 'Acme Corp',
          position: 'VP Sales',
          headline: 'VP Sales',
          seniorityBucket: 'Executive',
          buyingRole: 'Champion',
          relationshipStatus: 'new',
          lastInteractionAt: 1,
          relationshipLabel: 'new',
          relativeLastInteraction: 'Today'
        }
      ]
    },
    summary: {
      visibleConversations: 0,
      totalConversations: 0,
      totalAccounts: 1,
      visibleAccounts: 1,
      needsReplyCount: 0,
      draftCount: 0,
      followUpCount: 0
    }
  } as InboxWorkspaceViewModel;
}
