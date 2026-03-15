import { fireEvent, render, screen } from '@testing-library/react';
import type { ShellDataState } from '../../../lib/crm-shell';
import type { InboxWorkspaceViewModel } from '../../../lib/view-models/inbox';
import { describe, expect, it, vi } from 'vitest';
import { InboxWorkspace } from './inbox-workspace';

vi.mock('next/navigation', () => ({
  usePathname: () => '/inbox',
  useSearchParams: () => new URLSearchParams('')
}));

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
});

function buildState(): ShellDataState {
  return {
    view: 'ready',
    errorMessage: null,
    inbox: [],
    details: null,
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
    selectedItem: {
      contactId: 'contact-001',
      conversationId: 'conversation-001'
    },
    summary: {
      visibleConversations: 2,
      totalConversations: 2,
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
    }
  } as InboxWorkspaceViewModel;
}
