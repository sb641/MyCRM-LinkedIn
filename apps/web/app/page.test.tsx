import { render, screen } from '@testing-library/react';
import type { ContactConversationDetailsDto, InboxItemDto, SyncRunDto } from '@mycrm/core';
import HomePage from './page';

vi.mock('@/lib/services/inbox-service', () => ({
  listInboxItems: vi.fn(),
  getContactConversationDetails: vi.fn()
}));

vi.mock('@/lib/services/jobs-service', () => ({
  listSyncRuns: vi.fn()
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams('')
}));

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
    }
  ]
};

const inboxService = await import('@/lib/services/inbox-service');
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
    vi.mocked(jobsService.listSyncRuns).mockResolvedValue(syncRuns);

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
    expect(screen.getByText('Recent sync runs')).toBeInTheDocument();
    expect(screen.getByText('2/3 imported')).toBeInTheDocument();
  });

  it('renders the error state when inbox loading fails', async () => {
    vi.mocked(inboxService.listInboxItems).mockRejectedValue(new Error('Inbox failed'));
    vi.mocked(jobsService.listSyncRuns).mockResolvedValue([]);

    const page = await HomePage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText('Unable to load workspace')).toBeInTheDocument();
    expect(screen.getByText('Inbox failed')).toBeInTheDocument();
  });
});
