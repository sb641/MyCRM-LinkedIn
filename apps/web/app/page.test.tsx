import { render, screen } from '@testing-library/react';
import type { ContactConversationDetailsDto, InboxItemDto, SyncRunDto } from '@mycrm/core';
import HomePage from './page';

vi.mock('@/lib/services/inbox-service', () => ({
  listInboxItems: vi.fn(),
  getContactConversationDetails: vi.fn()
}));

vi.mock('@/lib/services/browser-session-service', () => ({
  getBrowserSession: vi.fn()
}));

vi.mock('@/lib/services/jobs-service', () => ({
  listSyncRuns: vi.fn(),
  listImportThreadJobs: vi.fn()
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams('')
}));

global.fetch = vi.fn();

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
  messages: [
    {
      id: 'message-001',
      linkedinMessageId: 'li-001',
      sender: 'Contact 1',
      senderType: 'contact',
      content: 'Hello',
      timestamp: 1,
      isInbound: true
    }
  ],
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
    },
    {
      id: 'draft-002',
      goalText: 'Share approved note',
      approvedText: 'Approved follow-up ready to send',
      draftStatus: 'approved',
      sendStatus: 'idle',
      modelName: 'mock-gemini',
      approvedAt: 2,
      sentAt: null,
      createdAt: 2
    }
  ]
};

const inboxService = await import('@/lib/services/inbox-service');
const browserSessionService = await import('@/lib/services/browser-session-service');
const jobsService = await import('@/lib/services/jobs-service');

const syncRuns: SyncRunDto[] = [
  {
    id: 'sync-001',
    provider: 'fake-linkedin',
    status: 'completed',
    startedAt: 1,
    finishedAt: 2,
    itemsScanned: 3,
    itemsImported: 2,
    error: null
  }
];

describe('HomePage', () => {
  it('renders the Phase 4 shell with CRM metadata and quick actions', async () => {
    vi.mocked(inboxService.listInboxItems).mockResolvedValue([inboxItem]);
    vi.mocked(inboxService.getContactConversationDetails).mockResolvedValue(details);
    vi.mocked(browserSessionService.getBrowserSession).mockResolvedValue({
      accountId: 'local-account',
      cookiesJson: '[]',
      capturedAt: 10,
      userAgent: 'Chrome 123'
    });
    vi.mocked(jobsService.listSyncRuns).mockResolvedValue(syncRuns);
    vi.mocked(jobsService.listImportThreadJobs).mockResolvedValue([
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
        auditEntries: []
      }
    ]);

    const page = await HomePage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText('LinkedIn CRM Workspace')).toBeInTheDocument();
    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Flags and actions')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contact 1' })).toBeInTheDocument();
    expect(screen.getByText('Review latest draft')).toBeInTheDocument();
    expect(screen.getByText('Drafts')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort conversations')).toBeInTheDocument();
    expect(screen.getByText('Generate with mock Gemini')).toBeInTheDocument();
    expect(screen.getByText('Follow-up')).toBeInTheDocument();
    expect(screen.getByText('Approved follow-up ready to send')).toBeInTheDocument();
    expect(screen.getByText('Queue send')).toBeInTheDocument();
    expect(screen.getByText('Recent sync runs')).toBeInTheDocument();
    expect(screen.getByText('2/3 imported')).toBeInTheDocument();
    expect(screen.getByText('Queue browser sync')).toBeInTheDocument();
    expect(screen.getByText('Active sync job')).toBeInTheDocument();
    expect(screen.getByText(/browser-account\s*·\s*linkedin-browser/)).toBeInTheDocument();
    expect(screen.getByText('Saved browser session ready')).toBeInTheDocument();
    expect(screen.getByText('Chrome 123')).toBeInTheDocument();
  });

  it('renders the error state when inbox loading fails', async () => {
    vi.mocked(inboxService.listInboxItems).mockRejectedValue(new Error('Inbox failed'));
    vi.mocked(browserSessionService.getBrowserSession).mockResolvedValue(null);
    vi.mocked(jobsService.listSyncRuns).mockResolvedValue([]);
    vi.mocked(jobsService.listImportThreadJobs).mockResolvedValue([]);

    const page = await HomePage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText('Unable to load workspace')).toBeInTheDocument();
    expect(screen.getByText('Inbox failed')).toBeInTheDocument();
  });
});
