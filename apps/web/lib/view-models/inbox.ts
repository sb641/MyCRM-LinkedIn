import type {
  AccountDetailsViewModel,
  AccountSummaryViewModel,
  ConversationDetailsViewModel,
  InboxListItemViewModel,
  ShellDataState
} from '@/lib/crm-shell';

export type InboxQueueKey = 'all' | 'needs-reply' | 'drafts' | 'follow-ups';
export type InboxEntityMode = 'people' | 'accounts';

export type InboxQueueTab = {
  key: InboxQueueKey;
  label: string;
  count: number;
  isActive: boolean;
};

export type InboxFilterChip = {
  label: string;
  value: string;
};

export type InboxWorkspaceViewModel = {
  queueTabs: InboxQueueTab[];
  activeQueue: InboxQueueKey;
  entityMode: InboxEntityMode;
  visibleItems: InboxListItemViewModel[];
  visibleAccounts: AccountSummaryViewModel[];
  selectedItem: InboxListItemViewModel | null;
  selectedAccount: AccountSummaryViewModel | null;
  details: ConversationDetailsViewModel | null;
  accountDetails: AccountDetailsViewModel | null;
  filterChips: InboxFilterChip[];
  summary: {
    totalConversations: number;
    visibleConversations: number;
    totalAccounts: number;
    visibleAccounts: number;
    needsReplyCount: number;
    draftCount: number;
    followUpCount: number;
  };
};

export function buildInboxWorkspaceViewModel(
  state: ShellDataState,
  options?: {
    queue?: string | null;
    entity?: string | null;
  }
): InboxWorkspaceViewModel {
  const activeQueue = getQueueKey(options?.queue);
  const entityMode = getEntityMode(options?.entity);
  const visibleItems = filterInboxItems(state.inbox, activeQueue);
  const visibleAccounts = filterAccounts(state.accounts, visibleItems, activeQueue);
  const selectedItem =
    visibleItems.find((item) => item.contactId === state.selectedItem?.contactId) ??
    state.selectedItem ??
    visibleItems[0] ??
    null;
  const requestedAccount = state.accountDetails
    ? state.accounts.find((account) => account.id === state.accountDetails?.account.id) ?? null
    : null;
  const selectedAccount =
    visibleAccounts.find((account) => account.id === state.accountDetails?.account.id) ??
    requestedAccount ??
    visibleAccounts[0] ??
    null;

  return {
    queueTabs: buildQueueTabs(state.inbox, activeQueue),
    activeQueue,
    entityMode,
    visibleItems,
    visibleAccounts,
    selectedItem,
    selectedAccount,
    details: state.details && selectedItem?.contactId === state.details.contact.id ? state.details : null,
    accountDetails:
      state.accountDetails && selectedAccount?.id === state.accountDetails.account.id ? state.accountDetails : null,
    filterChips: buildFilterChips(state, entityMode),
    summary: {
      totalConversations: state.inbox.length,
      visibleConversations: visibleItems.length,
      totalAccounts: state.accounts.length,
      visibleAccounts: visibleAccounts.length,
      needsReplyCount: countQueueItems(state.inbox, 'needs-reply'),
      draftCount: countQueueItems(state.inbox, 'drafts'),
      followUpCount: countQueueItems(state.inbox, 'follow-ups')
    }
  };
}

function buildQueueTabs(items: InboxListItemViewModel[], activeQueue: InboxQueueKey): InboxQueueTab[] {
  return [
    { key: 'all', label: 'All', count: items.length, isActive: activeQueue === 'all' },
    {
      key: 'needs-reply',
      label: 'Needs reply',
      count: countQueueItems(items, 'needs-reply'),
      isActive: activeQueue === 'needs-reply'
    },
    { key: 'drafts', label: 'Drafts', count: countQueueItems(items, 'drafts'), isActive: activeQueue === 'drafts' },
    {
      key: 'follow-ups',
      label: 'Follow-ups',
      count: countQueueItems(items, 'follow-ups'),
      isActive: activeQueue === 'follow-ups'
    }
  ];
}

function countQueueItems(items: InboxListItemViewModel[], queue: Exclude<InboxQueueKey, 'all'>) {
  return items.filter((item) => matchesQueue(item, queue)).length;
}

function filterInboxItems(items: InboxListItemViewModel[], queue: InboxQueueKey) {
  if (queue === 'all') {
    return items;
  }

  return items.filter((item) => matchesQueue(item, queue));
}

function matchesQueue(item: InboxListItemViewModel, queue: Exclude<InboxQueueKey, 'all'>) {
  if (queue === 'needs-reply') {
    return item.relationshipStatus === 'awaiting_reply' || item.unreadCount > 0;
  }

  if (queue === 'drafts') {
    return item.draftStatus === 'generated' || item.draftStatus === 'approved';
  }

  return item.relationshipStatus === 'followup_due' || item.nextReminderAt !== null;
}

function buildFilterChips(state: ShellDataState, entityMode: InboxEntityMode): InboxFilterChip[] {
  const chips: InboxFilterChip[] = [
    { label: 'Sort', value: formatSortLabel(state.sort) },
    { label: 'View', value: entityMode === 'people' ? 'People' : 'Accounts' }
  ];

  if (state.selectedItem?.company) {
    chips.push({ label: 'Account', value: state.selectedItem.company });
  }

  if (state.selectedItem?.outreachStatus) {
    chips.push({ label: 'Outreach', value: state.selectedItem.outreachStatus.replace(/_/g, ' ') });
  }

  return chips;
}

function formatSortLabel(sort: ShellDataState['sort']) {
  if (sort === 'needs-attention') {
    return 'Needs attention';
  }

  if (sort === 'name') {
    return 'Name';
  }

  return 'Recent';
}

function getQueueKey(value: string | null | undefined): InboxQueueKey {
  if (value === 'needs-reply' || value === 'drafts' || value === 'follow-ups') {
    return value;
  }

  return 'all';
}

function getEntityMode(value: string | null | undefined): InboxEntityMode {
  if (value === 'accounts') {
    return 'accounts';
  }

  return 'people';
}

function filterAccounts(
  accounts: AccountSummaryViewModel[],
  visibleItems: InboxListItemViewModel[],
  queue: InboxQueueKey
) {
  if (queue === 'all') {
    return accounts;
  }

  const visibleAccountIds = new Set(visibleItems.map((item) => item.accountId).filter(Boolean));
  return accounts.filter((account) => visibleAccountIds.has(account.id));
}