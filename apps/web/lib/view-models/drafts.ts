import type { ShellDataState } from '@/lib/crm-shell';

export type DraftReviewTabKey = 'needs-review' | 'approved' | 'sent' | 'failed';
export type DraftGroupingKey = 'status' | 'account' | 'campaign';

export type DraftReviewItem = {
  draftId: string;
  contactId: string;
  conversationId: string;
  contactName: string;
  company: string | null;
  accountId: string | null;
  role: string | null;
  relationshipStatus: string;
  draftStatus: string;
  sendStatus: string;
  statusLabel: string;
  goalText: string;
  approvedText: string | null;
  modelName: string | null;
  createdAt: number;
  createdAtLabel: string;
  generatedToday: boolean;
  openThreadHref: {
    pathname: '/inbox';
    query: {
      contactId: string;
      conversationId: string;
      queue: 'drafts';
    };
  };
};

export type DraftReviewGroup = {
  key: string;
  label: string;
  items: DraftReviewItem[];
};

export type DraftReviewViewModel = {
  activeTab: DraftReviewTabKey;
  activeGrouping: DraftGroupingKey;
  tabs: Array<{ key: DraftReviewTabKey; label: string; count: number; isActive: boolean }>;
  groups: DraftReviewGroup[];
  items: DraftReviewItem[];
  filters: {
    accounts: string[];
    roles: string[];
    tags: string[];
    campaigns: string[];
  };
};

export function buildDraftReviewViewModel(
  state: ShellDataState,
  options: {
    tab: string | null;
    groupBy: string | null;
    account: string | null;
    role: string | null;
    generatedToday: string | null;
  }
): DraftReviewViewModel {
  const activeTab = parseTab(options.tab);
  const activeGrouping = parseGrouping(options.groupBy);
  const items = state.inbox.flatMap((item) => {
    if (!state.details || state.details.conversation.id !== item.conversationId) {
      return [];
    }

    return state.details.drafts.map((draft) => toDraftReviewItem(item, draft));
  });

  const fallbackItems = items.length > 0 ? items : buildFallbackItems(state);
  const filteredItems = fallbackItems.filter((item) => matchesTab(item, activeTab))
    .filter((item) => !options.account || item.accountId === options.account)
    .filter((item) => !options.role || item.role === options.role)
    .filter((item) => options.generatedToday !== 'true' || item.generatedToday);

  return {
    activeTab,
    activeGrouping,
    tabs: buildTabs(fallbackItems, activeTab),
    groups: buildGroups(filteredItems, activeGrouping),
    items: filteredItems,
    filters: {
      accounts: uniqueValues(fallbackItems.map((item) => item.accountId)),
      roles: uniqueValues(fallbackItems.map((item) => item.role)),
      tags: [],
      campaigns: []
    }
  };
}

function buildFallbackItems(state: ShellDataState) {
  return state.inbox.flatMap((item) => {
    const details = state.selectedItem?.conversationId === item.conversationId ? state.details : null;
    return (details?.drafts ?? []).map((draft) => toDraftReviewItem(item, draft));
  });
}

function toDraftReviewItem(item: ShellDataState['inbox'][number], draft: NonNullable<ShellDataState['details']>['drafts'][number]): DraftReviewItem {
  return {
    draftId: draft.id,
    contactId: item.contactId,
    conversationId: item.conversationId,
    contactName: item.contactName,
    company: item.company ?? null,
    accountId: item.accountId ?? null,
    role: item.buyingRole ?? item.headline ?? null,
    relationshipStatus: item.relationshipStatus,
    draftStatus: draft.draftStatus,
    sendStatus: draft.sendStatus,
    statusLabel: draft.statusLabel,
    goalText: draft.goalText,
    approvedText: draft.approvedText,
    modelName: draft.modelName ?? null,
    createdAt: draft.createdAt,
    createdAtLabel: formatRelativeTime(draft.createdAt),
    generatedToday: Date.now() - draft.createdAt < 86_400_000,
    openThreadHref: {
      pathname: '/inbox',
      query: {
        contactId: item.contactId,
        conversationId: item.conversationId,
        queue: 'drafts'
      }
    }
  };
}

function buildTabs(items: DraftReviewItem[], activeTab: DraftReviewTabKey) {
  const tabs: Array<{ key: DraftReviewTabKey; label: string }> = [
    { key: 'needs-review', label: 'Needs Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'sent', label: 'Sent' },
    { key: 'failed', label: 'Failed' }
  ];

  return tabs.map((tab) => ({
    ...tab,
    count: items.filter((item) => matchesTab(item, tab.key)).length,
    isActive: tab.key === activeTab
  }));
}

function buildGroups(items: DraftReviewItem[], grouping: DraftGroupingKey): DraftReviewGroup[] {
  const groups = new Map<string, DraftReviewItem[]>();

  for (const item of items) {
    const key = getGroupKey(item, grouping);
    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([key, groupItems]) => ({
    key,
    label: key,
    items: groupItems.sort((left, right) => right.createdAt - left.createdAt)
  }));
}

function getGroupKey(item: DraftReviewItem, grouping: DraftGroupingKey) {
  if (grouping === 'account') {
    return item.accountId ?? 'No account';
  }

  if (grouping === 'campaign') {
    return 'No campaign';
  }

  return item.statusLabel;
}

function matchesTab(item: DraftReviewItem, tab: DraftReviewTabKey) {
  if (tab === 'needs-review') {
    return item.draftStatus === 'generated';
  }

  if (tab === 'approved') {
    return item.draftStatus === 'approved' && item.sendStatus !== 'sent' && item.sendStatus !== 'failed';
  }

  if (tab === 'sent') {
    return item.sendStatus === 'sent';
  }

  return item.sendStatus === 'failed';
}

function parseTab(value: string | null): DraftReviewTabKey {
  if (value === 'approved' || value === 'sent' || value === 'failed') {
    return value;
  }

  return 'needs-review';
}

function parseGrouping(value: string | null): DraftGroupingKey {
  if (value === 'account' || value === 'campaign') {
    return value;
  }

  return 'status';
}

function uniqueValues(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function formatRelativeTime(timestamp: number) {
  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) {
    return 'Just now';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return `${Math.floor(diffHours / 24)}d ago`;
}