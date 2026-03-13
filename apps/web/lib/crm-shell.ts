import type {
  ContactConversationDetailsDto,
  DraftStatus,
  InboxItemDto,
  RelationshipStatus,
  SendStatus,
  SyncRunDto
} from '@mycrm/core';

export type ShellViewState = 'ready' | 'empty' | 'error';

export type InboxSortMode = 'recent' | 'needs-attention' | 'name';

export type CrmBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type CrmBadge = {
  label: string;
  tone: CrmBadgeTone;
};

export type QuickAction = {
  label: string;
  intent: 'primary' | 'secondary' | 'warning';
  disabled?: boolean;
};

export type InboxListItemViewModel = InboxItemDto & {
  priorityRank: number;
  relativeLastMessage: string;
  badges: CrmBadge[];
  quickActions: QuickAction[];
};

export type MessageViewModel = ContactConversationDetailsDto['messages'][number] & {
  relativeTimestamp: string;
};

export type ContactSummaryViewModel = ContactConversationDetailsDto['contact'] & {
  derivedRelationshipStatus: RelationshipStatus;
  relationshipLabel: string;
  nextStepLabel: string;
  followupDueAt: number | null;
  followupDueLabel: string;
  followupUrgency: 'none' | 'soon' | 'due' | 'overdue';
  badges: CrmBadge[];
  quickActions: QuickAction[];
  lastInteractionLabel: string;
};

type FollowupRecommendation = {
  followupDueAt: number | null;
  followupDueLabel: string;
  urgency: 'none' | 'soon' | 'due' | 'overdue';
  nextStepLabel: string;
};

export type DraftSummaryViewModel = ContactConversationDetailsDto['drafts'][number] & {
  statusLabel: string;
};

export type ConversationDetailsViewModel = Omit<ContactConversationDetailsDto, 'contact' | 'messages' | 'drafts'> & {
  contact: ContactSummaryViewModel;
  messages: MessageViewModel[];
  drafts: DraftSummaryViewModel[];
};

export type ShellRouteState = {
  selectedContactId: string | null;
  selectedConversationId: string | null;
  sort: InboxSortMode;
};

export type ShellDataState = {
  view: ShellViewState;
  inbox: InboxListItemViewModel[];
  selectedItem: InboxListItemViewModel | null;
  details: ConversationDetailsViewModel | null;
  syncRuns: SyncRunViewModel[];
  errorMessage: string | null;
  sort: InboxSortMode;
};

export type SyncRunViewModel = SyncRunDto & {
  statusLabel: string;
  relativeStartedAt: string;
  summaryLabel: string;
};

export function getShellRouteState(
  searchParams: Record<string, string | string[] | undefined>,
  inbox: InboxItemDto[]
): ShellRouteState {
  const requestedContactId = getSingleValue(searchParams.contactId);
  const requestedConversationId = getSingleValue(searchParams.conversationId);
  const sort = getSortMode(getSingleValue(searchParams.sort));

  if (requestedContactId) {
    const matchedItem = inbox.find((item) => item.contactId === requestedContactId);
    if (matchedItem) {
      return {
        selectedContactId: matchedItem.contactId,
        selectedConversationId: matchedItem.conversationId,
        sort
      };
    }
  }

  if (requestedConversationId) {
    const matchedItem = inbox.find((item) => item.conversationId === requestedConversationId);
    if (matchedItem) {
      return {
        selectedContactId: matchedItem.contactId,
        selectedConversationId: matchedItem.conversationId,
        sort
      };
    }
  }

  const firstItem = inbox[0] ?? null;
  return {
    selectedContactId: firstItem?.contactId ?? null,
    selectedConversationId: firstItem?.conversationId ?? null,
    sort
  };
}

export function buildShellDataState(args: {
  inbox: InboxItemDto[];
  route: ShellRouteState;
  details: ContactConversationDetailsDto | null;
  syncRuns?: SyncRunDto[];
  errorMessage?: string | null;
}): ShellDataState {
  const inbox = buildInboxListItems(args.inbox, args.route.sort);
  const selectedItem = inbox.find((item) => item.contactId === args.route.selectedContactId) ?? null;
  const details = args.details ? buildConversationDetailsViewModel(args.details) : null;
  const syncRuns = buildSyncRunViewModels(args.syncRuns ?? []);

  if (args.errorMessage) {
    return {
      view: 'error',
      inbox,
      selectedItem,
      details: null,
      syncRuns,
      errorMessage: args.errorMessage,
      sort: args.route.sort
    };
  }

  if (args.inbox.length === 0) {
    return {
      view: 'empty',
      inbox: [],
      selectedItem: null,
      details: null,
      syncRuns,
      errorMessage: null,
      sort: args.route.sort
    };
  }

  return {
    view: 'ready',
    inbox,
    selectedItem,
    details,
    syncRuns,
    errorMessage: null,
    sort: args.route.sort
  };
}

export function buildSyncRunViewModels(syncRuns: SyncRunDto[]): SyncRunViewModel[] {
  return syncRuns.map((syncRun) => ({
    ...syncRun,
    statusLabel: formatSyncRunStatus(syncRun.status),
    relativeStartedAt: formatRelativeTime(syncRun.startedAt),
    summaryLabel: `${syncRun.itemsImported}/${syncRun.itemsScanned} imported`
  }));
}

export function deriveRelationshipStatus(details: ContactConversationDetailsDto): RelationshipStatus {
  const currentStatus = details.contact.relationshipStatus;
  const lastInbound = details.contact.lastReplyAt ?? 0;
  const lastOutbound = details.contact.lastSentAt ?? 0;

  if (currentStatus === 'archived') {
    return 'archived';
  }

  if (lastInbound > lastOutbound) {
    return 'replied';
  }

  if (lastOutbound > lastInbound) {
    return 'awaiting_reply';
  }

  return currentStatus;
}

export function buildInboxListItems(inbox: InboxItemDto[], sort: InboxSortMode): InboxListItemViewModel[] {
  return [...inbox]
    .map((item) => ({
      ...item,
      priorityRank: getPriorityRank(item),
      relativeLastMessage: formatRelativeTime(item.lastMessageAt),
      badges: buildInboxBadges(item),
      quickActions: buildInboxQuickActions(item)
    }))
    .sort((left, right) => compareInboxItems(left, right, sort));
}

export function buildConversationDetailsViewModel(
  details: ContactConversationDetailsDto
): ConversationDetailsViewModel {
  const derivedRelationshipStatus = deriveRelationshipStatus(details);
  const followupRecommendation = getFollowupRecommendation(details, derivedRelationshipStatus);

  return {
    ...details,
    contact: {
      ...details.contact,
      derivedRelationshipStatus,
      relationshipLabel: formatRelationshipLabel(derivedRelationshipStatus),
      nextStepLabel: followupRecommendation.nextStepLabel,
      followupDueAt: followupRecommendation.followupDueAt,
      followupDueLabel: followupRecommendation.followupDueLabel,
      followupUrgency: followupRecommendation.urgency,
      badges: buildContactBadges(details, derivedRelationshipStatus, followupRecommendation),
      quickActions: buildContactQuickActions(derivedRelationshipStatus, details.drafts.length, followupRecommendation),
      lastInteractionLabel: formatRelativeTime(details.contact.lastInteractionAt)
    },
    messages: details.messages.map((message) => ({
      ...message,
      relativeTimestamp: formatRelativeTime(message.timestamp)
    })),
    drafts: details.drafts.map((draft) => ({
      ...draft,
      statusLabel: formatDraftLabel(draft.draftStatus, draft.sendStatus)
    }))
  };
}

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getSortMode(value: string | null): InboxSortMode {
  if (value === 'needs-attention' || value === 'name') {
    return value;
  }

  return 'recent';
}

function compareInboxItems(
  left: InboxListItemViewModel,
  right: InboxListItemViewModel,
  sort: InboxSortMode
) {
  if (sort === 'name') {
    return left.contactName.localeCompare(right.contactName);
  }

  if (sort === 'needs-attention') {
    return right.priorityRank - left.priorityRank || compareByRecent(left, right);
  }

  return compareByRecent(left, right);
}

function compareByRecent(left: InboxListItemViewModel, right: InboxListItemViewModel) {
  return (right.lastMessageAt ?? 0) - (left.lastMessageAt ?? 0);
}

function getPriorityRank(item: InboxItemDto) {
  let rank = 0;

  if (item.relationshipStatus === 'awaiting_reply') {
    rank += 4;
  }

  if (item.relationshipStatus === 'followup_due') {
    rank += 5;
  }

  if (item.draftStatus === 'generated') {
    rank += 3;
  }

  if (item.sendStatus === 'failed') {
    rank += 6;
  }

  rank += Math.min(item.unreadCount, 3);
  return rank;
}

function buildInboxBadges(item: InboxItemDto): CrmBadge[] {
  const badges: CrmBadge[] = [
    {
      label: formatRelationshipLabel(item.relationshipStatus),
      tone: getRelationshipTone(item.relationshipStatus)
    }
  ];

  if (item.draftStatus !== 'none') {
    badges.push({
      label: formatDraftLabel(item.draftStatus, item.sendStatus),
      tone: item.sendStatus === 'failed' ? 'danger' : item.draftStatus === 'approved' ? 'success' : 'info'
    });
  }

  if (item.unreadCount > 0) {
    badges.push({ label: `${item.unreadCount} unread`, tone: 'warning' });
  }

  return badges;
}

function buildInboxQuickActions(item: InboxItemDto): QuickAction[] {
  if (item.sendStatus === 'failed') {
    return [{ label: 'Retry send', intent: 'warning' }];
  }

  if (item.draftStatus === 'generated') {
    return [{ label: 'Review draft', intent: 'primary' }];
  }

  if (item.relationshipStatus === 'awaiting_reply' || item.relationshipStatus === 'followup_due') {
    return [{ label: 'Prepare follow-up', intent: 'secondary' }];
  }

  return [{ label: 'Open thread', intent: 'secondary' }];
}

function formatSyncRunStatus(status: string) {
  if (status === 'completed') {
    return 'Completed';
  }

  if (status === 'failed') {
    return 'Failed';
  }

  return 'Running';
}

function buildContactBadges(
  details: ContactConversationDetailsDto,
  relationshipStatus: RelationshipStatus,
  followupRecommendation: FollowupRecommendation
): CrmBadge[] {
  const badges: CrmBadge[] = [
    {
      label: formatRelationshipLabel(relationshipStatus),
      tone: getRelationshipTone(relationshipStatus)
    },
    {
      label: `${details.messages.length} messages`,
      tone: 'neutral'
    }
  ];

  if (details.drafts.length > 0) {
    badges.push({
      label: `${details.drafts.length} drafts`,
      tone: details.drafts[0]?.draftStatus === 'approved' ? 'success' : 'info'
    });
  }

  if (followupRecommendation.followupDueLabel !== 'No follow-up scheduled') {
    badges.push({
      label: followupRecommendation.followupDueLabel,
      tone: getFollowupTone(followupRecommendation.urgency)
    });
  }

  return badges;
}

function buildContactQuickActions(
  relationshipStatus: RelationshipStatus,
  draftCount: number,
  followupRecommendation: FollowupRecommendation
): QuickAction[] {
  const actions: QuickAction[] = [];

  if (followupRecommendation.urgency === 'overdue' || followupRecommendation.urgency === 'due') {
    actions.push({ label: 'Send follow-up now', intent: 'warning' });
    actions.push({ label: 'Generate follow-up draft', intent: 'primary' });
  }

  if (draftCount > 0) {
    actions.push({ label: 'Review latest draft', intent: 'primary' });
  }

  if (relationshipStatus === 'awaiting_reply' || relationshipStatus === 'followup_due') {
    actions.push({ label: 'Mark follow-up', intent: 'secondary' });
  }

  actions.push({ label: 'Update status', intent: 'secondary' });
  return actions;
}

function getRelationshipTone(status: RelationshipStatus): CrmBadgeTone {
  switch (status) {
    case 'replied':
      return 'success';
    case 'awaiting_reply':
    case 'followup_due':
      return 'warning';
    case 'archived':
      return 'neutral';
    default:
      return 'info';
  }
}

function formatRelationshipLabel(status: RelationshipStatus) {
  return status.replace(/_/g, ' ');
}

function formatDraftLabel(draftStatus: DraftStatus, sendStatus: SendStatus) {
  if (sendStatus === 'failed') {
    return 'send failed';
  }

  if (sendStatus === 'sent') {
    return 'sent';
  }

  return draftStatus.replace(/_/g, ' ');
}

function getNextStepLabel(status: RelationshipStatus, draftCount: number) {
  if (draftCount > 0) {
    return 'Review saved draft';
  }

  if (status === 'awaiting_reply') {
    return 'Wait for reply';
  }

  if (status === 'replied') {
    return 'Respond while context is fresh';
  }

  if (status === 'followup_due') {
    return 'Prepare follow-up';
  }

  return 'Qualify contact';
}

function getFollowupRecommendation(
  details: ContactConversationDetailsDto,
  relationshipStatus: RelationshipStatus
): FollowupRecommendation {
  const baseTimestamp = details.contact.lastReplyAt ?? details.contact.lastSentAt ?? details.contact.lastInteractionAt ?? null;

  if (!baseTimestamp || relationshipStatus === 'archived' || relationshipStatus === 'replied') {
    return {
      followupDueAt: null,
      followupDueLabel: 'No follow-up scheduled',
      urgency: 'none',
      nextStepLabel: getNextStepLabel(relationshipStatus, details.drafts.length)
    };
  }

  const followupWindowDays = relationshipStatus === 'followup_due' ? 2 : relationshipStatus === 'awaiting_reply' ? 4 : 7;
  const followupDueAt = baseTimestamp + followupWindowDays * 86_400_000;
  const deltaMs = followupDueAt - Date.now();
  const urgency = getFollowupUrgency(deltaMs);

  return {
    followupDueAt,
    followupDueLabel: formatFollowupDueLabel(followupDueAt, urgency),
    urgency,
    nextStepLabel: getFollowupNextStepLabel(urgency, details.drafts.length)
  };
}

function getFollowupUrgency(deltaMs: number): 'none' | 'soon' | 'due' | 'overdue' {
  if (deltaMs < 0) {
    return 'overdue';
  }

  if (deltaMs <= 86_400_000) {
    return 'due';
  }

  if (deltaMs <= 3 * 86_400_000) {
    return 'soon';
  }

  return 'none';
}

function formatFollowupDueLabel(followupDueAt: number, urgency: 'none' | 'soon' | 'due' | 'overdue') {
  if (urgency === 'overdue') {
    return 'Follow-up overdue';
  }

  if (urgency === 'due') {
    return 'Follow-up due today';
  }

  if (urgency === 'soon') {
    return `Follow-up due ${formatRelativeTime(followupDueAt)}`;
  }

  return `Follow-up planned ${formatRelativeTime(followupDueAt)}`;
}

function getFollowupNextStepLabel(urgency: 'none' | 'soon' | 'due' | 'overdue', draftCount: number) {
  if (urgency === 'overdue') {
    return draftCount > 0 ? 'Review saved follow-up draft' : 'Prepare overdue follow-up';
  }

  if (urgency === 'due') {
    return draftCount > 0 ? 'Send or revise today\'s follow-up' : 'Generate today\'s follow-up';
  }

  if (urgency === 'soon') {
    return 'Queue the next follow-up';
  }

  return getNextStepLabel('new', draftCount);
}

function getFollowupTone(urgency: 'none' | 'soon' | 'due' | 'overdue'): CrmBadgeTone {
  if (urgency === 'overdue') {
    return 'danger';
  }

  if (urgency === 'due') {
    return 'warning';
  }

  if (urgency === 'soon') {
    return 'info';
  }

  return 'neutral';
}

function formatRelativeTime(timestamp: number | null) {
  if (!timestamp) {
    return 'No activity yet';
  }

  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);

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

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}