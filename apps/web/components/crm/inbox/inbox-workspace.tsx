'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { FeatureFlags } from '@mycrm/core';
import type { ShellDataState } from '@/lib/crm-shell';
import { BulkDraftModal, type BulkDraftSelection } from '@/components/crm/modals/bulk-draft-modal';
import { DeleteIgnoreModal } from '@/components/crm/modals/delete-ignore-modal';
import { ReminderModal } from '@/components/crm/modals/reminder-modal';
import { ReminderBadge } from '@/components/crm/shared/reminder-badge';
import type { InboxWorkspaceViewModel } from '@/lib/view-models/inbox';

const WORKSPACE_REPLACE_CONFIRMATION = 'REPLACE WORKSPACE';
const SYNC_STATUS_POLL_INTERVAL_MS = 2000;

type SyncDiagnosticsSnapshot = {
  jobId: string | null;
  accountId: string;
  phase: 'idle' | 'queueing' | 'queued' | 'running' | 'completed' | 'failed' | 'stalled';
  startedAt: number;
  updatedAt: number;
  lastMessage: string;
  lastError: string | null;
  pollCount: number;
  activeJobStatus: string | null;
  latestRunStatus: string | null;
};

function formatDuration(ms: number) {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s`;
}

function formatSyncPhaseLabel(phase: SyncDiagnosticsSnapshot['phase']) {
  switch (phase) {
    case 'queueing':
      return 'Queueing sync request';
    case 'queued':
      return 'Queued, waiting for worker pickup';
    case 'running':
      return 'Worker is running sync';
    case 'completed':
      return 'Sync completed';
    case 'failed':
      return 'Sync failed';
    case 'stalled':
      return 'Queued too long, worker may be offline';
    default:
      return 'Idle';
  }
}

type InboxWorkspaceProps = {
  state: ShellDataState;
  workspace: InboxWorkspaceViewModel;
  flags: FeatureFlags;
};

function SyncConversationsButton({
  className,
  isSyncing,
  onClick
}: {
  className: string;
  isSyncing: boolean;
  onClick: () => void;
}) {
  return (
    <button className={className} type="button" onClick={onClick} disabled={isSyncing}>
      {isSyncing ? 'Syncing conversations...' : 'Sync Conversations'}
    </button>
  );
}

export function InboxWorkspace({ state, workspace, flags }: InboxWorkspaceProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaultAccountId =
    state.browserSession?.accountId ||
    state.settings.find((entry) => entry.key === 'default_account_id')?.value ||
    'local-account';
  const [draftGoal, setDraftGoal] = useState('Follow up on the latest conversation and propose a concrete next step.');
  const [generatedDraft, setGeneratedDraft] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkGenerationMessage, setBulkGenerationMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncAccountId, setSyncAccountId] = useState(defaultAccountId);
  const [syncDiagnostics, setSyncDiagnostics] = useState<SyncDiagnosticsSnapshot | null>(null);
  const [isQueueingSend, setIsQueueingSend] = useState<string | null>(null);
  const [sendMessage, setSendMessage] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [settingsValues, setSettingsValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(state.settings.map((entry) => [entry.key, '']))
  );
  const [settingsReset, setSettingsReset] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(state.settings.map((entry) => [entry.key, false]))
  );
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [backupPayload, setBackupPayload] = useState('');
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountDomain, setNewAccountDomain] = useState('');
  const [newAccountNotes, setNewAccountNotes] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [accountActionMessage, setAccountActionMessage] = useState<string | null>(null);
  const [accountActionError, setAccountActionError] = useState<string | null>(null);
  const [selectedAccountContactIds, setSelectedAccountContactIds] = useState<string[]>([]);
  const [mergeSourceAccountId, setMergeSourceAccountId] = useState('');
  const [isAssigningContacts, setIsAssigningContacts] = useState(false);
  const [isMergingAccounts, setIsMergingAccounts] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [ignoreTarget, setIgnoreTarget] = useState<{ contactId: string; contactName: string } | null>(null);

  const restorePreview = getRestorePreview(backupPayload);
  const isAccountsMode = workspace.entityMode === 'accounts';
  const selectedAccountId = workspace.accountDetails?.account.id ?? workspace.selectedAccount?.id ?? null;
  const assignableContacts = state.inbox.filter((item) => item.accountId !== selectedAccountId);
  const mergeCandidates = workspace.visibleAccounts.filter((account) => account.id !== selectedAccountId);
  const effectiveMergeSourceAccountId =
    mergeSourceAccountId && mergeCandidates.some((account) => account.id === mergeSourceAccountId) ? mergeSourceAccountId : '';
  const stakeholderLanes = workspace.accountDetails ? buildStakeholderLanes(workspace.accountDetails.contacts) : [];
  const visibleConversationItems = workspace.visibleItems.filter(
    (item, index, items) => items.findIndex((candidate) => candidate.conversationId === item.conversationId) === index
  );
  const syncPhaseLabel = syncDiagnostics ? formatSyncPhaseLabel(syncDiagnostics.phase) : null;
  const syncElapsedLabel = syncDiagnostics ? formatDuration(Date.now() - syncDiagnostics.startedAt) : null;
  const syncDebugLines = useMemo(() => {
    if (!syncDiagnostics) {
      return [] as string[];
    }

    return [
      `phase=${syncDiagnostics.phase}`,
      `job=${syncDiagnostics.jobId ?? 'n/a'}`,
      `account=${syncDiagnostics.accountId}`,
      `polls=${syncDiagnostics.pollCount}`,
      `activeJob=${syncDiagnostics.activeJobStatus ?? 'none'}`,
      `latestRun=${syncDiagnostics.latestRunStatus ?? 'none'}`,
      `updated=${new Date(syncDiagnostics.updatedAt).toLocaleTimeString()}`
    ];
  }, [syncDiagnostics]);

  useEffect(() => {
    if (!syncDiagnostics?.jobId) {
      return;
    }

    if (
      syncDiagnostics.phase === 'completed' ||
      syncDiagnostics.phase === 'failed' ||
      syncDiagnostics.phase === 'stalled'
    ) {
      return;
    }

    let cancelled = false;

    const pollStatus = async () => {
      try {
        const response = await fetch('/api/jobs', {
          method: 'GET',
          cache: 'no-store'
        });
        const body = await response.json();

        if (!response.ok || cancelled) {
          return;
        }

        const jobs = Array.isArray(body.jobs) ? body.jobs : [];
        const syncRuns = Array.isArray(body.syncRuns) ? body.syncRuns : [];
        const matchingJob = jobs.find((entry: { job?: { id?: string; status?: string; lastError?: string | null } }) => entry?.job?.id === syncDiagnostics.jobId);
        const matchingRun = syncRuns.find(
          (entry: { provider?: string; status?: string; startedAt?: number; error?: string | null }) =>
            entry?.provider === 'linkedin-browser' &&
            typeof entry?.startedAt === 'number' &&
            entry.startedAt >= syncDiagnostics.startedAt - 5_000
        );

        setSyncDiagnostics((current) => {
          if (!current || current.jobId !== syncDiagnostics.jobId) {
            return current;
          }

          const now = Date.now();
          const jobStatus = matchingJob?.job?.status ?? null;
          const runStatus = matchingRun?.status ?? null;
          const queuedTooLong =
            (jobStatus === 'queued' || jobStatus === null) && now - current.startedAt > 15_000;

          let phase = current.phase;
          let lastMessage = current.lastMessage;
          let lastError = current.lastError;

          if (runStatus === 'failed' || jobStatus === 'failed' || jobStatus === 'retry_scheduled') {
            phase = 'failed';
            lastError = matchingRun?.error ?? matchingJob?.job?.lastError ?? current.lastError;
            lastMessage = lastError ? `Sync failed: ${lastError}` : 'Sync failed';
          } else if (runStatus === 'completed' || jobStatus === 'succeeded') {
            phase = 'completed';
            lastMessage = 'Sync completed. Refresh inbox data to see imported conversations.';
          } else if (runStatus === 'running' || jobStatus === 'running') {
            phase = 'running';
            lastMessage = 'Worker picked up the job and is syncing conversations.';
          } else if (queuedTooLong) {
            phase = 'stalled';
            lastMessage = 'Job is still queued. Worker may be stopped or blocked.';
          } else {
            phase = 'queued';
            lastMessage = 'Sync queued. Waiting for worker pickup.';
          }

          return {
            ...current,
            phase,
            updatedAt: now,
            lastMessage,
            lastError,
            pollCount: current.pollCount + 1,
            activeJobStatus: jobStatus,
            latestRunStatus: runStatus
          };
        });
      } catch {
        if (cancelled) {
          return;
        }

        setSyncDiagnostics((current) => {
          if (!current || current.jobId !== syncDiagnostics.jobId) {
            return current;
          }

          return {
            ...current,
            updatedAt: Date.now(),
            pollCount: current.pollCount + 1,
            lastMessage: 'Status poll failed. Retrying...',
            lastError: current.lastError
          };
        });
      }
    };

    void pollStatus();
    const intervalId = window.setInterval(() => {
      void pollStatus();
    }, SYNC_STATUS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [syncDiagnostics?.jobId, syncDiagnostics?.phase, syncDiagnostics?.startedAt]);

  function refreshWorkspace(options?: {
    nextAccountId?: string | null;
    nextContactId?: string | null;
    nextConversationId?: string | null;
  }) {
    const query = buildQueryParams(searchParams, {
      entity: workspace.entityMode,
      queue: workspace.activeQueue,
      sort: state.sort,
      accountId: options?.nextAccountId ?? selectedAccountId,
      contactId:
        options && 'nextContactId' in options
          ? options.nextContactId ?? undefined
          : workspace.selectedItem?.contactId ?? state.selectedItem?.contactId,
      conversationId:
        options && 'nextConversationId' in options
          ? options.nextConversationId ?? undefined
          : workspace.selectedItem?.conversationId ?? state.selectedItem?.conversationId
    });

    const nextUrl = `${pathname}?${query.toString()}`;

    window.location.assign(nextUrl);
  }

  function handleIgnoreSuccess() {
    refreshWorkspace({
      nextAccountId: selectedAccountId,
      nextContactId: null,
      nextConversationId: null
    });
  }

  async function handleGenerateDraft() {
    if (!workspace.details || isAccountsMode) {
      return;
    }

    setGenerationError(null);
    setGeneratedDraft(null);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/drafts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contactId: workspace.details.contact.id,
          goal: draftGoal
        })
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? body.error?.message ?? 'Unable to generate draft');
      }

      setGeneratedDraft(body.draft.approvedText ?? body.draft.goalText ?? 'Draft generated');
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Unable to generate draft');
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleConversationSelection(conversationId: string) {
    setSelectedConversationIds((current) =>
      current.includes(conversationId)
        ? current.filter((item) => item !== conversationId)
        : [...current, conversationId]
    );
  }

  function clearConversationSelection() {
    setSelectedConversationIds([]);
  }

  const selectedPeople: BulkDraftSelection[] = visibleConversationItems
    .filter((item) => selectedConversationIds.includes(item.conversationId))
    .map((item) => ({
      contactId: item.contactId,
      conversationId: item.conversationId,
      contactName: item.contactName,
      company: item.company ?? null
    }));

  const reminderEntityId = isAccountsMode
    ? workspace.accountDetails?.account.id ?? workspace.selectedAccount?.id ?? null
    : workspace.details?.contact.id ?? workspace.selectedItem?.contactId ?? null;
  const canManageReminder = reminderEntityId !== null;

  async function handleManualSync() {
    const accountId = syncAccountId.trim() || defaultAccountId;
    setSyncMessage(null);
    setSyncError(null);
    setIsSyncing(true);
    setSyncDiagnostics({
      jobId: null,
      accountId,
      phase: 'queueing',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      lastMessage: 'Submitting manual sync request...',
      lastError: null,
      pollCount: 0,
      activeJobStatus: null,
      latestRunStatus: null
    });

    try {
      const response = await fetch('/api/jobs?mode=manual-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accountId, provider: 'linkedin-browser' })
      });
      const body = await response.json();
      if (!response.ok) {
        const checks = body?.details?.checks;
        const checksSummary = checks
          ? Object.entries(checks)
              .map(([key, value]) => `${key}=${String(value)}`)
              .join(', ')
          : null;
        const message = [body.message ?? body.error?.message ?? 'Unable to queue sync', checksSummary]
          .filter(Boolean)
          .join(' | ');
        throw new Error(message);
      }

      const jobId = body.jobId ?? body.job?.id ?? null;
      setSyncMessage(`Sync queued for ${jobId ?? 'queued job'}`);
      setSyncDiagnostics((current) => ({
        jobId,
        accountId,
        phase: 'queued',
        startedAt: current?.startedAt ?? Date.now(),
        updatedAt: Date.now(),
        lastMessage: `Sync queued for ${jobId ?? 'queued job'}`,
        lastError: null,
        pollCount: 0,
        activeJobStatus: 'queued',
        latestRunStatus: null
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to queue sync';
      setSyncError(message);
      setSyncDiagnostics((current) => ({
        jobId: current?.jobId ?? null,
        accountId,
        phase: 'failed',
        startedAt: current?.startedAt ?? Date.now(),
        updatedAt: Date.now(),
        lastMessage: `Sync request failed: ${message}`,
        lastError: message,
        pollCount: current?.pollCount ?? 0,
        activeJobStatus: current?.activeJobStatus ?? null,
        latestRunStatus: current?.latestRunStatus ?? null
      }));
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleQueueSend(draftId: string, conversationId: string | null | undefined) {
    if (!conversationId) {
      setSendMessage(null);
      setSendError('Unable to send draft');
      return;
    }

    const accountId = syncAccountId.trim() || defaultAccountId;

    setSendMessage(null);
    setSendError(null);
    setIsQueueingSend(draftId);

    try {
      const draftIdParam = encodeURIComponent(draftId);
      const response = await fetch(`/api/drafts/${draftIdParam}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          draftId,
          conversationId,
          accountId,
          provider: 'linkedin-browser'
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? body.error?.message ?? 'Unable to send draft');
      }

      setSendMessage(`Queued send for ${body.jobId ?? body.draft?.id ?? draftId}`);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Unable to send draft');
    } finally {
      setIsQueueingSend(null);
    }
  }

  async function handleSaveSettings() {
    setSettingsMessage(null);
    setSettingsError(null);
    setIsSavingSettings(true);

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: state.settings.map((entry) => ({
            key: entry.key,
            value: settingsValues[entry.key] ?? '',
            isSecret: entry.isSecret,
            reset: settingsReset[entry.key] ?? false
          }))
        })
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? body.error?.message ?? 'Unable to save settings');
      }

      setSettingsMessage(`Saved ${body.settings.length} settings`);
      setSettingsReset(Object.fromEntries(state.settings.map((entry) => [entry.key, false])));
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Unable to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleExportBackup() {
    setSettingsMessage(null);
    setSettingsError(null);

    try {
      const response = await fetch('/api/backup?includeSecrets=false');
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? body.error?.message ?? 'Unable to export backup');
      }

      setBackupPayload(JSON.stringify(body, null, 2));
      setSettingsMessage('Backup exported without secrets');
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Unable to export backup');
    }
  }

  async function handleImportBackup() {
    setSettingsMessage(null);
    setSettingsError(null);

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(backupPayload);
    } catch {
      setSettingsError('Restore payload must be valid JSON');
      return;
    }

    const requiresWorkspaceReplaceConfirmation =
      typeof parsedPayload === 'object' &&
      parsedPayload !== null &&
      'scope' in parsedPayload &&
      'mode' in parsedPayload &&
      (parsedPayload as { scope?: unknown }).scope === 'workspace' &&
      (parsedPayload as { mode?: unknown }).mode === 'replace';

    if (
      requiresWorkspaceReplaceConfirmation &&
      restoreConfirmation.trim() !== WORKSPACE_REPLACE_CONFIRMATION
    ) {
      setSettingsError(`Type ${WORKSPACE_REPLACE_CONFIRMATION} to confirm workspace replace restore`);
      return;
    }

    try {
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: backupPayload
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? body.error?.message ?? 'Unable to import backup');
      }

      if (requiresWorkspaceReplaceConfirmation) {
        setSettingsMessage(`Workspace restored and ${body.settings.length} settings imported`);
        setRestoreConfirmation('');
      } else {
        setSettingsMessage(`Imported ${body.settings.length} settings`);
      }
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Unable to import backup');
    }
  }

  function toggleAccountContactSelection(contactId: string) {
    setSelectedAccountContactIds((current) =>
      current.includes(contactId) ? current.filter((item) => item !== contactId) : [...current, contactId]
    );
  }

  async function handleCreateAccount() {
    const name = newAccountName.trim();
    if (!name) {
      setAccountActionError('Account name is required');
      setAccountActionMessage(null);
      return;
    }

    setAccountActionError(null);
    setAccountActionMessage(null);
    setIsCreatingAccount(true);

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          domain: newAccountDomain.trim() || undefined,
          notes: newAccountNotes.trim() || undefined
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? body.error?.message ?? 'Unable to create account');
      }

      setAccountActionMessage(`Created account ${body.account.name}`);
      setNewAccountName('');
      setNewAccountDomain('');
      setNewAccountNotes('');
      refreshWorkspace({ nextAccountId: body.account.id });
    } catch (error) {
      setAccountActionError(error instanceof Error ? error.message : 'Unable to create account');
    } finally {
      setIsCreatingAccount(false);
    }
  }

  async function handleAssignContacts() {
    if (!selectedAccountId || selectedAccountContactIds.length === 0) {
      return;
    }

    setAccountActionError(null);
    setAccountActionMessage(null);
    setIsAssigningContacts(true);

    try {
      const response = await fetch(`/api/accounts/${encodeURIComponent(selectedAccountId)}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contactIds: selectedAccountContactIds
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? body.error?.message ?? 'Unable to assign contacts');
      }

      setAccountActionMessage(`Assigned ${body.contacts.length} stakeholders to ${body.account.name}`);
      setSelectedAccountContactIds([]);
      refreshWorkspace({ nextAccountId: selectedAccountId });
    } catch (error) {
      setAccountActionError(error instanceof Error ? error.message : 'Unable to assign contacts');
    } finally {
      setIsAssigningContacts(false);
    }
  }

  async function handleMergeAccounts() {
    if (!selectedAccountId || !effectiveMergeSourceAccountId) {
      return;
    }

    setAccountActionError(null);
    setAccountActionMessage(null);
    setIsMergingAccounts(true);

    try {
      const response = await fetch('/api/accounts/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourceAccountId: effectiveMergeSourceAccountId,
          targetAccountId: selectedAccountId
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? body.error?.message ?? 'Unable to merge accounts');
      }

      setAccountActionMessage(`Merged ${effectiveMergeSourceAccountId} into ${body.account.name}`);
      setMergeSourceAccountId('');
      refreshWorkspace({ nextAccountId: selectedAccountId });
    } catch (error) {
      setAccountActionError(error instanceof Error ? error.message : 'Unable to merge accounts');
    } finally {
      setIsMergingAccounts(false);
    }
  }

  async function handleSaveReminder(input: { dueAt: number; note: string }) {
    const entityType = isAccountsMode ? 'account' : 'contact';
    const entityId = reminderEntityId;

    if (!entityId) {
      throw new Error('No record selected for reminder');
    }

    setReminderMessage(null);
    setReminderError(null);

    const response = await fetch('/api/reminders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        entityType,
        entityId,
        dueAt: input.dueAt,
        note: input.note,
        ruleType: 'manual'
      })
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.message ?? body.error?.message ?? 'Unable to save reminder');
    }

    setReminderMessage('Reminder saved');
    refreshWorkspace({ nextAccountId: selectedAccountId });
  }

  async function handleCompleteReminder() {
    const entityType = isAccountsMode ? 'account' : 'contact';
    const entityId = reminderEntityId;

    if (!entityId) {
      setReminderError('No record selected for reminder');
      return;
    }

    setReminderMessage(null);
    setReminderError(null);

    try {
      const listResponse = await fetch(`/api/reminders?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`);
      const listBody = await listResponse.json();
      if (!listResponse.ok) {
        throw new Error(listBody.message ?? listBody.error?.message ?? 'Unable to load reminders');
      }

      const activeReminder = (listBody.reminders as Array<{ id: string; completedAt: number | null }>).find(
        (entry) => entry.completedAt === null
      );
      if (!activeReminder) {
        throw new Error('No active reminder found');
      }

      const response = await fetch(`/api/reminders/${encodeURIComponent(activeReminder.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'completed', completedAt: Date.now() })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? body.error?.message ?? 'Unable to complete reminder');
      }

      setReminderMessage('Reminder completed');
      refreshWorkspace({ nextAccountId: selectedAccountId });
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : 'Unable to complete reminder');
    }
  }

  return (
    <main className="crm-page">
      <div className="crm-backdrop" />
      <div className="crm-shell inbox-workspace-shell">
        <header className="topbar inbox-topbar inbox-operator-topbar">
          <div className="inbox-operator-heading">
            <div>
              <p className="eyebrow">Inbox</p>
              <h1 className="hero-title inbox-operator-title">Operator workspace</h1>
            </div>
            <p className="hero-copy inbox-operator-copy">Queue on the left, active thread and drafts in the center, context on the right.</p>
          </div>
          <div className="topbar-actions inbox-operator-actions" aria-label="Top bar actions">
            <div className="inbox-operator-action-group" aria-label="Sync and reminders">
              <SyncConversationsButton className="ghost-button" isSyncing={isSyncing} onClick={handleManualSync} />
              {syncDiagnostics ? <div className="subtle-pill">{syncPhaseLabel}: {syncElapsedLabel}</div> : null}
              <button
                className="ghost-button"
                type="button"
                onClick={() => setIsReminderModalOpen(true)}
                disabled={!canManageReminder}
                title={canManageReminder ? undefined : 'Select a record before setting a reminder'}
              >
                Set reminder
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={handleCompleteReminder}
                disabled={!canManageReminder}
                title={canManageReminder ? undefined : 'Select a record before completing a reminder'}
              >
                Complete reminder
              </button>
            </div>
            <div className="inbox-operator-action-group" aria-label="Draft actions">
              {!isAccountsMode && workspace.details ? (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() =>
                    setIgnoreTarget({
                      contactId: workspace.details?.contact.id ?? workspace.selectedItem?.contactId ?? '',
                      contactName: workspace.details?.contact.name ?? workspace.selectedItem?.contactName ?? 'this person'
                    })
                  }
                >
                  Ignore Person
                </button>
              ) : null}
              <button
                className="ghost-button"
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                disabled={selectedPeople.length === 0 || isAccountsMode}
              >
                {selectedPeople.length > 0 && !isAccountsMode ? `Bulk Generate (${selectedPeople.length})` : 'Bulk Generate'}
              </button>
              <button className="accent-button" type="button" onClick={handleGenerateDraft} disabled={!workspace.details || isGenerating || isAccountsMode}>
                {isGenerating ? 'Generating draft...' : 'Generate Draft'}
              </button>
            </div>
          </div>
        </header>

        <section className="inbox-queue-bar panel inbox-queue-toolbar">
          <div className="inbox-queue-tabs" aria-label="Inbox queues">
            {workspace.queueTabs.map((tab) => (
              <Link
                key={tab.key}
                href={{
                  pathname,
                  query: buildQuery(searchParams, {
                    queue: tab.key,
                    entity: workspace.entityMode,
                    contactId: workspace.selectedItem?.contactId ?? state.selectedItem?.contactId,
                    conversationId: workspace.selectedItem?.conversationId ?? state.selectedItem?.conversationId,
                    sort: state.sort
                  })
                }}
                className={tab.isActive ? 'queue-tab active' : 'queue-tab'}
              >
                <span>{tab.label}</span>
                <span className="count-pill">{tab.count}</span>
              </Link>
            ))}
          </div>
          <div className="inbox-toolbar-meta inbox-toolbar-meta-compact">
            <div className="entity-toggle" aria-label="Inbox entity mode">
              <Link
                href={{
                  pathname,
                  query: buildQuery(searchParams, {
                    entity: 'people',
                    queue: workspace.activeQueue,
                    sort: state.sort
                  })
                }}
                className={workspace.entityMode === 'people' ? 'entity-pill active' : 'entity-pill'}
              >
                People
              </Link>
              <Link
                href={{
                  pathname,
                  query: buildQuery(searchParams, {
                    entity: 'accounts',
                    queue: workspace.activeQueue,
                    sort: state.sort
                  })
                }}
                className={workspace.entityMode === 'accounts' ? 'entity-pill active' : 'entity-pill'}
              >
                Accounts
              </Link>
            </div>
            <div className="chip-row" aria-label="Inbox filters summary">
              {workspace.filterChips.map((chip) => (
                <span key={`${chip.label}-${chip.value}`} className="subtle-pill">
                  {chip.label}: {chip.value}
                </span>
              ))}
            </div>
            <div className="chip-row inbox-summary-chips" aria-label="Inbox workspace summary">
              <span className="subtle-pill">Needs reply {workspace.summary.needsReplyCount}</span>
              <span className="subtle-pill">Drafts {workspace.summary.draftCount}</span>
              <span className="subtle-pill">Follow-ups {workspace.summary.followUpCount}</span>
            </div>
          </div>
        </section>

        <div className="workspace-grid inbox-workspace-grid">
          <aside className="panel sidebar-panel inbox-list-panel">
            <div className="panel-header panel-header-compact inbox-list-header">
              <div>
                <p className="eyebrow">Queue</p>
                <h2 className="panel-title">{workspace.entityMode === 'people' ? 'People' : 'Accounts'}</h2>
              </div>
              <div className="panel-header-actions panel-header-actions-compact">
                <span className="subtle-pill">Visible {isAccountsMode ? workspace.summary.visibleAccounts : workspace.summary.visibleConversations}</span>
                <span className="count-pill">{isAccountsMode ? workspace.summary.totalAccounts : workspace.summary.totalConversations}</span>
                {selectedPeople.length > 0 && !isAccountsMode ? (
                  <button className="ghost-button" type="button" onClick={clearConversationSelection}>
                    Clear selection
                  </button>
                ) : null}
              </div>
            </div>

            <div className="inbox-list-controls" aria-label="Queue controls">
              <div className="inbox-list-controls-row">
                <span className="subtle-pill">{workspace.activeQueue}</span>
                <span className="subtle-pill">Sort {state.sort}</span>
              </div>
              <div className="inbox-list-controls-row inbox-list-controls-row-scroll" aria-label="Active filters">
                {workspace.filterChips.map((chip) => (
                  <span key={`queue-${chip.label}-${chip.value}`} className="subtle-pill">
                    {chip.label}: {chip.value}
                  </span>
                ))}
              </div>
            </div>

            {state.view === 'empty' ? (
              <EmptyState title="Inbox is empty" body="Run a sync or seed more fixtures to populate the queue." />
            ) : isAccountsMode ? (
              workspace.visibleAccounts.length === 0 ? (
                <EmptyState title="No accounts in this queue" body="Create an account or assign contacts to start grouping stakeholders." />
              ) : (
                <nav className="conversation-list dense-list queue-list" aria-label="Account list">
                  {workspace.visibleAccounts.map((account) => {
                    const isActive = workspace.selectedAccount?.id === account.id;

                    return (
                      <Link
                        key={account.id}
                        href={{
                          pathname,
                          query: buildQuery(searchParams, {
                            accountId: account.id,
                            queue: workspace.activeQueue,
                            entity: workspace.entityMode,
                            sort: state.sort
                          })
                        }}
                        className={isActive ? 'conversation-card active dense-card queue-list-item' : 'conversation-card dense-card queue-list-item'}
                      >
                        <div className="queue-list-item-main">
                          <div className="conversation-row conversation-row-selectable queue-list-item-topline">
                            <strong className="queue-list-item-title">{account.name}</strong>
                            <span className="subtle-pill">{account.relativeUpdatedAt}</span>
                          </div>
                          <p className="conversation-meta queue-list-item-meta">
                            {account.domain ?? 'No domain'} · {account.relationshipLabel}
                          </p>
                          <p className="conversation-preview queue-list-item-preview">{account.notes?.trim() || 'No account notes yet'}</p>
                        </div>
                        <div className="chip-row queue-list-item-chips" aria-label="Account badges">
                          {account.badges.map((badge) => (
                            <span key={`${account.id}-${badge.label}`} className={`status-chip tone-${badge.tone}`}>
                              {badge.label}
                            </span>
                          ))}
                          {account.reminderLabel && account.reminderTone ? (
                            <ReminderBadge
                              label={account.reminderLabel}
                              tone={account.reminderTone === 'danger' ? 'danger' : account.reminderTone === 'warning' ? 'warning' : 'neutral'}
                            />
                          ) : null}
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              )
            ) : visibleConversationItems.length === 0 ? (
              <EmptyState title="No conversations in this queue" body="Switch queue tabs or sync more data to continue." />
            ) : (
              <nav className="conversation-list dense-list queue-list" aria-label="Conversation list">
                {visibleConversationItems.map((item) => {
                  const isActive = workspace.selectedItem?.contactId === item.contactId;
                  const isSelected = selectedConversationIds.includes(item.conversationId);

                  return (
                    <div
                      key={item.conversationId}
                      className={isActive ? 'conversation-card active dense-card queue-list-item' : 'conversation-card dense-card queue-list-item'}
                    >
                      <button
                        className={isSelected ? 'conversation-select-toggle selected' : 'conversation-select-toggle'}
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`Select ${item.contactName}`}
                        onClick={() => toggleConversationSelection(item.conversationId)}
                      >
                        <input type="checkbox" checked={isSelected} readOnly tabIndex={-1} aria-hidden="true" />
                      </button>
                      <Link
                        href={{
                          pathname,
                          query: buildQuery(searchParams, {
                            contactId: item.contactId,
                            conversationId: item.conversationId,
                            queue: workspace.activeQueue,
                            entity: workspace.entityMode,
                            sort: state.sort
                          })
                        }}
                        className="queue-list-item-link"
                      >
                        <div className="queue-list-item-main">
                          <div className="conversation-row conversation-row-selectable queue-list-item-topline">
                            <strong className="queue-list-item-title">{workspace.entityMode === 'accounts' ? item.company ?? item.contactName : item.contactName}</strong>
                            <span className="subtle-pill">{item.relativeLastMessage}</span>
                          </div>
                          <p className="conversation-meta queue-list-item-meta">{item.company ?? 'Independent'} · {item.headline ?? 'No headline yet'}</p>
                          <p className="conversation-preview queue-list-item-preview">{item.lastMessageText ?? 'No messages yet'}</p>
                        </div>
                        <div className="queue-list-item-side" onClick={(event) => event.preventDefault()}>
                          <div className="quick-action-row queue-list-item-actions" aria-label="Conversation quick actions">
                            <button
                              className="mini-action intent-warning"
                              type="button"
                              onClick={() => setIgnoreTarget({ contactId: item.contactId, contactName: item.contactName })}
                            >
                              Ignore
                            </button>
                          </div>
                          <div className="chip-row queue-list-item-chips" aria-label="Conversation badges">
                            {item.badges.map((badge) => (
                              <span key={`${item.conversationId}-${badge.label}`} className={`status-chip tone-${badge.tone}`}>
                                {badge.label}
                              </span>
                            ))}
                            {item.reminderLabel && item.reminderTone ? (
                              <ReminderBadge
                                label={item.reminderLabel}
                                tone={item.reminderTone === 'danger' ? 'danger' : item.reminderTone === 'warning' ? 'warning' : 'neutral'}
                              />
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </nav>
            )}

            <section className="rail-section inbox-rail-tools" aria-label="Queue tools">
              <div className="rail-section-header">
                <p className="eyebrow">Sync</p>
                <span className="subtle-pill">Operator</span>
              </div>
              <label className="draft-goal-field compact-field">
                <span>Account ID</span>
                <input value={syncAccountId} onChange={(event) => setSyncAccountId(event.target.value)} />
              </label>
              <SyncConversationsButton className="accent-button rail-action" isSyncing={isSyncing} onClick={handleManualSync} />
              {syncMessage ? <p className="generated-draft-preview">{syncMessage}</p> : null}
              {syncError ? <p className="generated-draft-error">{syncError}</p> : null}
              {syncDiagnostics ? (
                <div className="generated-draft-preview" data-testid="sync-diagnostics">
                  <strong>{syncPhaseLabel}</strong>
                  <p>{syncDiagnostics.lastMessage}</p>
                  <p>
                    Elapsed: {syncElapsedLabel} · Last update: {new Date(syncDiagnostics.updatedAt).toLocaleTimeString()}
                  </p>
                  {syncDiagnostics.lastError ? <p className="generated-draft-error">{syncDiagnostics.lastError}</p> : null}
                  <pre className="generated-draft-preview">{syncDebugLines.join('\n')}</pre>
                </div>
              ) : null}
            </section>

            <section className="rail-section inbox-rail-admin" aria-label="Workspace admin tools">
              <div className="rail-section-header">
                <p className="eyebrow">Admin</p>
                <span className="subtle-pill">Workspace</span>
              </div>
              <div className="quick-action-row rail-action-row">
                <button className="ghost-button" type="button" onClick={handleSaveSettings} disabled={isSavingSettings}>
                  {isSavingSettings ? 'Saving...' : 'Save settings'}
                </button>
                <button className="ghost-button" type="button" onClick={handleExportBackup}>
                  Export backup
                </button>
              </div>
              {settingsMessage ? <p className="generated-draft-preview">{settingsMessage}</p> : null}
              {settingsError ? <p className="generated-draft-error">{settingsError}</p> : null}
              <details className="rail-restore-panel">
                <summary>Restore workspace data</summary>
                <div className="rail-restore-content">
                  <p className="stack-copy">
                    Export creates a workspace snapshot without secrets. Restore expects a valid snapshot payload.
                  </p>
                  <label className="draft-goal-field compact-field">
                    <span>Restore/import payload</span>
                    <textarea value={backupPayload} onChange={(event) => setBackupPayload(event.target.value)} rows={8} />
                  </label>
                  {restorePreview ? (
                    <p className="conversation-meta">
                      Scope: <strong>{restorePreview.scope}</strong> · Mode: <strong>{restorePreview.mode}</strong>
                    </p>
                  ) : null}
                  <label className="draft-goal-field compact-field">
                    <span>Replace confirmation</span>
                    <input value={restoreConfirmation} onChange={(event) => setRestoreConfirmation(event.target.value)} />
                  </label>
                  <div className="quick-action-row rail-action-row">
                    <button className="ghost-button" type="button" onClick={() => setBackupPayload('')}>
                      Clear
                    </button>
                    <button className="ghost-button" type="button" onClick={handleImportBackup} disabled={!backupPayload.trim()}>
                      Restore
                    </button>
                  </div>
                </div>
              </details>
            </section>
          </aside>

          <section className="panel main-panel inbox-main-panel">
            <div className="panel-header panel-header-compact">
              <div>
                <p className="eyebrow">Workspace</p>
                <h2 className="panel-title">{isAccountsMode ? 'Account workspace' : 'Conversation and drafts'}</h2>
              </div>
              <div className="panel-header-actions panel-header-actions-compact">
                <span className="subtle-pill">{isAccountsMode ? 'ABM grouping' : 'Queue-first'}</span>
                {!isAccountsMode && workspace.details ? (
                  <span className="subtle-pill">{workspace.details.messages.length} messages</span>
                ) : null}
                {!isAccountsMode && workspace.details ? (
                  <span className="subtle-pill">{workspace.details.drafts.length} drafts</span>
                ) : null}
              </div>
            </div>

            {state.view === 'error' ? (
              <ErrorState message={state.errorMessage ?? 'Unknown error'} />
            ) : isAccountsMode ? (
              !workspace.accountDetails ? (
                <EmptyState title="No account selected" body="Choose an account to review aliases and stakeholders." />
              ) : (
                <div className="timeline-layout inbox-main-layout">
                  <section className="contact-summary">
                    <div className="conversation-row">
                      <div>
                        <h3>{workspace.accountDetails.account.name}</h3>
                        <p>
                          {workspace.accountDetails.account.domain ?? 'No domain'} · {workspace.accountDetails.account.relationshipLabel}
                        </p>
                      </div>
                      <span className="subtle-pill">Updated {workspace.accountDetails.account.relativeUpdatedAt}</span>
                    </div>
                    <div className="summary-chips" aria-label="Account badges">
                      {workspace.accountDetails.account.badges.map((badge) => (
                        <span key={badge.label} className={`status-chip tone-${badge.tone}`}>
                          {badge.label}
                        </span>
                      ))}
                      {workspace.accountDetails.account.reminderLabel && workspace.accountDetails.account.reminderTone ? (
                        <ReminderBadge
                          label={workspace.accountDetails.account.reminderLabel}
                          tone={workspace.accountDetails.account.reminderTone === 'danger' ? 'danger' : workspace.accountDetails.account.reminderTone === 'warning' ? 'warning' : 'neutral'}
                        />
                      ) : null}
                    </div>
                    {reminderMessage ? <p className="generated-draft-preview">{reminderMessage}</p> : null}
                    {reminderError ? <p className="generated-draft-error">{reminderError}</p> : null}
                    <dl className="contact-facts">
                      <div>
                        <dt>Stakeholders</dt>
                        <dd>{workspace.accountDetails.contacts.length}</dd>
                      </div>
                      <div>
                        <dt>Aliases</dt>
                        <dd>{workspace.accountDetails.account.aliases.length}</dd>
                      </div>
                      <div>
                        <dt>Primary alias</dt>
                        <dd>{workspace.accountDetails.account.primaryAlias ?? 'None'}</dd>
                      </div>
                      <div>
                        <dt>Domain</dt>
                        <dd>{workspace.accountDetails.account.domain ?? 'Unknown'}</dd>
                      </div>
                    </dl>
                    {workspace.accountDetails.account.notes ? (
                      <div className="followup-callout urgency-none">
                        <strong>Notes</strong>
                        <p>{workspace.accountDetails.account.notes}</p>
                      </div>
                    ) : null}
                  </section>

                  <div className="inbox-content-columns">
                    <section className="message-stack dense-stack" aria-label="Stakeholders">
                      <div className="conversation-row">
                        <h3>Stakeholders</h3>
                        <span className="subtle-pill">{workspace.accountDetails.contacts.length}</span>
                      </div>
                      {workspace.accountDetails.contacts.length === 0 ? (
                        <EmptyState title="No stakeholders assigned" body="Assign contacts to this account to build the ABM workspace." />
                      ) : (
                        workspace.accountDetails.contacts.map((contact) => (
                          <article key={contact.id} className="message-card inbound">
                            <div className="conversation-row">
                              <strong>{contact.name}</strong>
                              <span className="subtle-pill">{contact.relativeLastInteraction}</span>
                            </div>
                            <p className="message-meta">
                              {contact.company ?? 'Independent'} · {contact.position ?? contact.headline ?? 'No role yet'}
                            </p>
                            <div className="chip-row" aria-label="Stakeholder badges">
                              <span className="status-chip tone-info">{contact.relationshipLabel}</span>
                              {contact.seniorityBucket ? <span className="status-chip tone-neutral">{contact.seniorityBucket}</span> : null}
                              {contact.buyingRole ? <span className="status-chip tone-neutral">{contact.buyingRole}</span> : null}
                            </div>
                          </article>
                        ))
                      )}
                    </section>

                    <section className="draft-stack dense-stack" aria-label="Account aliases">
                      <div className="conversation-row">
                        <h3>Aliases</h3>
                        <span className="subtle-pill">{workspace.accountDetails.account.aliases.length}</span>
                      </div>
                      {workspace.accountDetails.account.aliases.length === 0 ? (
                        <EmptyState title="No aliases yet" body="Merged or imported names will appear here for operator review." />
                      ) : (
                        workspace.accountDetails.account.aliases.map((alias) => (
                          <article key={alias.id} className="draft-card">
                            <div className="conversation-row">
                              <strong>{alias.alias}</strong>
                              <span className="subtle-pill">{alias.source}</span>
                            </div>
                          </article>
                        ))
                      )}
                    </section>
                  </div>

                  <section className="draft-stack" aria-label="Stakeholder lanes">
                    <div className="conversation-row">
                      <h3>Stakeholder lanes</h3>
                      <span className="subtle-pill">Coverage map</span>
                    </div>
                    <div className="inbox-content-columns">
                      {stakeholderLanes.map((lane) => (
                        <section key={lane.key} className="stack-card" aria-label={`${lane.label} lane`}>
                          <div className="conversation-row">
                            <strong>{lane.label}</strong>
                            <span className="subtle-pill">{lane.contacts.length}</span>
                          </div>
                          {lane.contacts.length === 0 ? (
                            <p className="stack-copy">No stakeholders in this lane yet.</p>
                          ) : (
                            <div className="sync-run-list">
                              {lane.contacts.map((contact) => (
                                <article key={`${lane.key}-${contact.id}`} className="draft-card">
                                  <div className="conversation-row">
                                    <strong>{contact.name}</strong>
                                    <span className="subtle-pill">{contact.relationshipLabel}</span>
                                  </div>
                                  <p className="conversation-meta">
                                    {contact.position ?? contact.headline ?? 'No role yet'} · {contact.relativeLastInteraction}
                                  </p>
                                </article>
                              ))}
                            </div>
                          )}
                        </section>
                      ))}
                    </div>
                  </section>

                  <div className="inbox-content-columns">
                    <section className="draft-stack" aria-label="Create account">
                      <div className="conversation-row">
                        <h3>Create account</h3>
                        <span className="subtle-pill">Manual</span>
                      </div>
                      <label className="draft-goal-field">
                        <span>Account name</span>
                        <input value={newAccountName} onChange={(event) => setNewAccountName(event.target.value)} />
                      </label>
                      <label className="draft-goal-field">
                        <span>Domain</span>
                        <input value={newAccountDomain} onChange={(event) => setNewAccountDomain(event.target.value)} />
                      </label>
                      <label className="draft-goal-field">
                        <span>Notes</span>
                        <textarea value={newAccountNotes} onChange={(event) => setNewAccountNotes(event.target.value)} rows={3} />
                      </label>
                      <button className="accent-button" type="button" onClick={handleCreateAccount} disabled={isCreatingAccount}>
                        {isCreatingAccount ? 'Creating account...' : 'Create account'}
                      </button>
                    </section>

                    <section className="draft-stack" aria-label="Assign stakeholders">
                      <div className="conversation-row">
                        <h3>Assign stakeholders</h3>
                        <span className="subtle-pill">{selectedAccountContactIds.length} selected</span>
                      </div>
                      {assignableContacts.length === 0 ? (
                        <EmptyState title="No unassigned stakeholders" body="All visible contacts already belong to this account." />
                      ) : (
                        <div className="sync-run-list" aria-label="Assignable stakeholders">
                          {assignableContacts.map((contact) => (
                            <label key={contact.contactId} className="conversation-card conversation-row-selectable">
                              <input
                                type="checkbox"
                                checked={selectedAccountContactIds.includes(contact.contactId)}
                                onChange={() => toggleAccountContactSelection(contact.contactId)}
                                aria-label={`Assign ${contact.contactName}`}
                              />
                              <div>
                                <strong>{contact.contactName}</strong>
                                <p className="conversation-meta">{contact.company ?? 'Independent'} · {contact.headline ?? 'No role yet'}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                      <button
                        className="accent-button"
                        type="button"
                        onClick={handleAssignContacts}
                        disabled={!selectedAccountId || selectedAccountContactIds.length === 0 || isAssigningContacts}
                      >
                        {isAssigningContacts ? 'Assigning...' : 'Assign selected'}
                      </button>
                    </section>
                  </div>

                  <section className="draft-stack" aria-label="Merge accounts">
                    <div className="conversation-row">
                      <h3>Merge accounts</h3>
                      <span className="subtle-pill">Preserve aliases</span>
                    </div>
                    <label className="draft-goal-field">
                      <span>Source account</span>
                      <select value={effectiveMergeSourceAccountId} onChange={(event) => setMergeSourceAccountId(event.target.value)}>
                        <option value="">Select account</option>
                        {mergeCandidates.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={handleMergeAccounts}
                      disabled={!selectedAccountId || !effectiveMergeSourceAccountId || isMergingAccounts}
                    >
                      {isMergingAccounts ? 'Merging...' : 'Merge into current account'}
                    </button>
                  </section>

                  {accountActionMessage ? <p className="generated-draft-preview">{accountActionMessage}</p> : null}
                  {accountActionError ? <p className="generated-draft-error">{accountActionError}</p> : null}
                </div>
              )
            ) : !workspace.details ? (
              <EmptyState title="No conversation selected" body="Choose a queue item to open the conversation workspace." />
            ) : (
              <div className="timeline-layout inbox-main-layout inbox-thread-workspace">
                <section className="contact-summary inbox-thread-summary">
                  <div className="conversation-row">
                    <div>
                      <h3>{workspace.details.contact.name}</h3>
                      <p>{workspace.details.contact.company ?? 'Independent'} · {workspace.details.contact.headline ?? 'No headline yet'}</p>
                    </div>
                    <span className="subtle-pill">{workspace.details.contact.relationshipLabel}</span>
                  </div>
                  <div className="summary-chips" aria-label="Contact badges">
                    {workspace.details.contact.badges.map((badge) => (
                      <span key={badge.label} className={`status-chip tone-${badge.tone}`}>
                        {badge.label}
                      </span>
                    ))}
                    {workspace.details.contact.reminderLabel && workspace.details.contact.reminderTone ? (
                      <ReminderBadge
                        label={workspace.details.contact.reminderLabel}
                        tone={workspace.details.contact.reminderTone === 'danger' ? 'danger' : workspace.details.contact.reminderTone === 'warning' ? 'warning' : 'neutral'}
                      />
                    ) : null}
                  </div>
                  {reminderMessage ? <p className="generated-draft-preview">{reminderMessage}</p> : null}
                  {reminderError ? <p className="generated-draft-error">{reminderError}</p> : null}
                  <dl className="contact-facts">
                    <div>
                      <dt>Relationship</dt>
                      <dd>{workspace.details.contact.relationshipLabel}</dd>
                    </div>
                    <div>
                      <dt>Last activity</dt>
                      <dd>{workspace.details.contact.lastInteractionLabel}</dd>
                    </div>
                    <div>
                      <dt>Next step</dt>
                      <dd>{workspace.details.contact.nextStepLabel}</dd>
                    </div>
                    <div>
                      <dt>Follow-up</dt>
                      <dd>{workspace.details.contact.followupDueLabel}</dd>
                    </div>
                    <div>
                      <dt>Seniority</dt>
                      <dd>{workspace.details.contact.seniorityBucket ?? 'Unknown'}</dd>
                    </div>
                    <div>
                      <dt>Buying role</dt>
                      <dd>{workspace.details.contact.buyingRole ?? 'Unknown'}</dd>
                    </div>
                  </dl>
                  {workspace.details.contact.followupUrgency !== 'none' ? (
                    <div className={`followup-callout urgency-${workspace.details.contact.followupUrgency}`}>
                      <strong>{workspace.details.contact.followupDueLabel}</strong>
                      <p>{workspace.details.contact.nextStepLabel}</p>
                    </div>
                  ) : null}
                </section>

                <section className="inbox-thread-surface" aria-label="Conversation workspace">
                  <div className="inbox-thread-header">
                    <div>
                      <p className="eyebrow">Active thread</p>
                      <h3>Conversation timeline</h3>
                    </div>
                    <div className="panel-header-actions panel-header-actions-compact">
                      <span className="subtle-pill">{workspace.details.messages.length} messages</span>
                      <span className="subtle-pill">{workspace.details.drafts.length} drafts</span>
                    </div>
                  </div>

                  <div className="inbox-thread-columns">
                    <section className="message-stack dense-stack inbox-thread-timeline" aria-label="Conversation history">
                      {workspace.details.messages.length === 0 ? (
                        <EmptyState title="No messages yet" body="This queue item has no synced message history yet." />
                      ) : (
                        workspace.details.messages.map((message) => (
                          <article
                            key={message.id}
                            className={message.isInbound ? 'message-card inbound inbox-thread-message' : 'message-card outbound inbox-thread-message'}
                          >
                            <div className="conversation-row">
                              <strong>{message.sender}</strong>
                              <span className="subtle-pill">{message.relativeTimestamp}</span>
                            </div>
                            <p className="message-meta">{message.senderType}</p>
                            <p>{message.content}</p>
                          </article>
                        ))
                      )}
                    </section>

                    <section className="draft-stack dense-stack inbox-thread-drafts" aria-label="Draft workspace">
                      <div className="draft-generator-card inbox-thread-composer">
                        <div className="conversation-row">
                          <div>
                            <p className="eyebrow">Composer</p>
                            <h3>Draft reply</h3>
                          </div>
                          <span className="subtle-pill">Main action</span>
                        </div>
                        <label className="draft-goal-field compact-field">
                          <span>What should this message achieve?</span>
                          <textarea value={draftGoal} onChange={(event) => setDraftGoal(event.target.value)} rows={4} />
                        </label>
                        <button className="accent-button" type="button" onClick={handleGenerateDraft} disabled={isGenerating}>
                          {isGenerating ? 'Generating draft...' : 'Generate Draft'}
                        </button>
                        {generatedDraft ? <p className="generated-draft-preview">{generatedDraft}</p> : null}
                        {generationError ? <p className="generated-draft-error">{generationError}</p> : null}
                      </div>

                      <section className="draft-stack inbox-thread-draft-history" aria-label="Draft history">
                        <div className="conversation-row">
                          <h3>Draft history</h3>
                          <span className="subtle-pill">{workspace.details.drafts.length}</span>
                        </div>
                        {workspace.details.drafts.length === 0 ? (
                          <EmptyState title="No drafts yet" body="Generate a draft or wait for the next AI suggestion." />
                        ) : (
                          workspace.details.drafts.map((draft) => (
                            <article key={draft.id} className="draft-card inbox-thread-draft-card">
                              <div className="conversation-row">
                                <strong>{draft.statusLabel}</strong>
                                <span className="subtle-pill">{draft.modelName ?? 'Manual'}</span>
                              </div>
                              <p>{draft.approvedText ?? draft.goalText}</p>
                              {draft.draftStatus === 'approved' ? (
                                <button
                                  className="ghost-button"
                                  type="button"
                                  onClick={() => handleQueueSend(draft.id, state.selectedItem?.conversationId)}
                                  disabled={isQueueingSend === draft.id}
                                >
                                  {isQueueingSend === draft.id ? 'Sending...' : 'Send Message'}
                                </button>
                              ) : null}
                            </article>
                          ))
                        )}
                        {sendMessage ? <p className="generated-draft-preview">{sendMessage}</p> : null}
                        {sendError ? <p className="generated-draft-error">{sendError}</p> : null}
                        {bulkGenerationMessage ? <p className="generated-draft-preview">{bulkGenerationMessage}</p> : null}
                      </section>
                    </section>
                  </div>
                </section>
              </div>
            )}
          </section>

          <aside className="panel side-panel inbox-context-panel">
            <div className="panel-header panel-header-compact">
              <div>
                <p className="eyebrow">Context</p>
                <h2 className="panel-title">Signals</h2>
              </div>
              <span className="subtle-pill">Live context</span>
            </div>

            {!isAccountsMode && workspace.details ? (
              <div className="stack-card context-summary-card operator-context-card">
                <div className="conversation-row">
                  <p className="eyebrow">Contact snapshot</p>
                  <span className="subtle-pill">Active</span>
                </div>
                <div className="operator-context-identity">
                  <strong>{workspace.details.contact.name}</strong>
                  <p className="conversation-meta">{workspace.details.contact.company ?? 'Independent'} · {workspace.details.contact.headline ?? 'No headline yet'}</p>
                </div>
                <dl className="flag-list operator-flag-list">
                  <div>
                    <dt>Relationship</dt>
                    <dd>{workspace.details.contact.relationshipLabel}</dd>
                  </div>
                  <div>
                    <dt>Next step</dt>
                    <dd>{workspace.details.contact.nextStepLabel}</dd>
                  </div>
                  <div>
                    <dt>Follow-up</dt>
                    <dd>{workspace.details.contact.followupDueLabel}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            {isAccountsMode && workspace.accountDetails ? (
              <div className="stack-card context-summary-card operator-context-card">
                <div className="conversation-row">
                  <p className="eyebrow">Account snapshot</p>
                  <span className="subtle-pill">ABM</span>
                </div>
                <div className="operator-context-identity">
                  <strong>{workspace.accountDetails.account.name}</strong>
                  <p className="conversation-meta">{workspace.accountDetails.account.domain ?? 'No domain'} · {workspace.accountDetails.account.relationshipLabel}</p>
                </div>
                <dl className="flag-list operator-flag-list">
                  <div>
                    <dt>Stakeholders</dt>
                    <dd>{workspace.accountDetails.contacts.length}</dd>
                  </div>
                  <div>
                    <dt>Aliases</dt>
                    <dd>{workspace.accountDetails.account.aliases.length}</dd>
                  </div>
                  <div>
                    <dt>Primary alias</dt>
                    <dd>{workspace.accountDetails.account.primaryAlias ?? 'None'}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <div className="stack-card context-summary-card operator-context-card">
              <div className="conversation-row">
                <p className="eyebrow">Queue health</p>
                <span className="subtle-pill">Phase 02</span>
              </div>
              <dl className="flag-list operator-flag-list">
                <div>
                  <dt>Needs reply</dt>
                  <dd>{workspace.summary.needsReplyCount}</dd>
                </div>
                <div>
                  <dt>Drafts</dt>
                  <dd>{workspace.summary.draftCount}</dd>
                </div>
                <div>
                  <dt>Follow-ups</dt>
                  <dd>{workspace.summary.followUpCount}</dd>
                </div>
              </dl>
            </div>

            <div className="stack-card context-summary-card operator-context-card">
              <div className="conversation-row">
                <p className="eyebrow">Automation status</p>
                <span className="subtle-pill">Runtime</span>
              </div>
              <dl className="flag-list operator-flag-list">
                <div>
                  <dt>AI</dt>
                  <dd>{String(flags.ENABLE_AI)}</dd>
                </div>
                <div>
                  <dt>Automation</dt>
                  <dd>{String(flags.ENABLE_AUTOMATION)}</dd>
                </div>
                <div>
                  <dt>Browser sync</dt>
                  <dd>{String(flags.ENABLE_REAL_BROWSER_SYNC)}</dd>
                </div>
                <div>
                  <dt>Real send</dt>
                  <dd>{String(flags.ENABLE_REAL_SEND)}</dd>
                </div>
              </dl>
            </div>

            {state.browserSession ? (
              <div className="stack-card context-summary-card operator-context-card">
                <div className="conversation-row">
                  <p className="eyebrow">LinkedIn session</p>
                  <span className="subtle-pill">Saved</span>
                </div>
                <div className="sync-session-summary" aria-label="Saved browser session">
                  <p>{state.browserSession.statusLabel}</p>
                  <p className="conversation-meta">{state.browserSession.accountId}</p>
                  <p className="conversation-meta">Captured {state.browserSession.capturedAtLabel}</p>
                  <p className="conversation-meta">{state.browserSession.userAgentLabel}</p>
                </div>
              </div>
            ) : null}

            {state.activeSyncJob ? (
              <div className="stack-card context-summary-card operator-context-card">
                <div className="conversation-row">
                  <p className="eyebrow">Sync in progress</p>
                  <span className="subtle-pill">Live</span>
                </div>
                <p>{state.activeSyncJob.statusLabel}</p>
                <p className="conversation-meta">
                  {state.activeSyncJob.accountId} · {state.activeSyncJob.provider}
                </p>
                <p className="conversation-meta">Updated {state.activeSyncJob.relativeUpdatedAt}</p>
                <p className="conversation-meta">Audit entries: {state.activeSyncJob.auditCount}</p>
                {state.activeSyncJob.operatorMessage ? <p className="stack-copy">{state.activeSyncJob.operatorMessage}</p> : null}
                {state.activeSyncJob.lastError ? <p className="generated-draft-error">{state.activeSyncJob.lastError}</p> : null}
              </div>
            ) : null}

            {state.syncRuns.length > 0 ? (
              <div className="stack-card context-summary-card operator-context-card">
                <div className="conversation-row">
                  <p className="eyebrow">Recent sync runs</p>
                  <span className="subtle-pill">{state.syncRuns.length}</span>
                </div>
                <div className="sync-run-list" aria-label="Sync history">
                  {state.syncRuns.slice(0, 3).map((syncRun) => (
                    <article key={syncRun.id} className="draft-card">
                      <div className="conversation-row">
                        <strong>{syncRun.statusLabel}</strong>
                        <span className="subtle-pill">{syncRun.relativeStartedAt}</span>
                      </div>
                      <p>{syncRun.provider}</p>
                      <p className="conversation-meta">{syncRun.summaryLabel}</p>
                      {syncRun.finishedAt ? <p className="conversation-meta">Finished</p> : <p className="conversation-meta">Still running</p>}
                      {syncRun.operatorMessage ? <p className="stack-copy">{syncRun.operatorMessage}</p> : null}
                      {syncRun.error ? <p className="generated-draft-error">{syncRun.error}</p> : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>

      </div>
      <BulkDraftModal
        isOpen={isBulkModalOpen}
        selections={selectedPeople}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={(message) => {
          setBulkGenerationMessage(message);
          setIsBulkModalOpen(false);
          clearConversationSelection();
        }}
      />
      <DeleteIgnoreModal
        isOpen={ignoreTarget !== null}
        contactId={ignoreTarget?.contactId ?? null}
        contactName={ignoreTarget?.contactName ?? 'this person'}
        onClose={() => setIgnoreTarget(null)}
        onSuccess={handleIgnoreSuccess}
      />
      <ReminderModal
        open={isReminderModalOpen}
        title={isAccountsMode ? 'Set account reminder' : 'Set contact reminder'}
        onClose={() => setIsReminderModalOpen(false)}
        onSubmit={handleSaveReminder}
      />
    </main>
  );
}

function buildQuery(
  searchParams: ReturnType<typeof useSearchParams>,
  updates: Record<string, string | null | undefined>
) {
  return Object.fromEntries(buildQueryParams(searchParams, updates).entries());
}

function buildQueryParams(
  searchParams: ReturnType<typeof useSearchParams>,
  updates: Record<string, string | null | undefined>
) {
  const params = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      params.delete(key);
      continue;
    }

    params.set(key, value);
  }

  return params;
}

function getRestorePreview(payload: string) {
  if (!payload.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as {
      scope?: string;
      mode?: string;
      settings?: unknown[];
      workspace?: Record<string, unknown[]>;
    };

    const workspaceCounts = Object.entries(parsed.workspace ?? {}).map(([label, value]) => ({
      label,
      count: Array.isArray(value) ? value.length : 0
    }));

    const secretCount = (parsed.settings ?? []).filter(
      (entry) => typeof entry === 'object' && entry !== null && 'isSecret' in entry && (entry as { isSecret?: boolean }).isSecret
    ).length;

    return {
      scope: parsed.scope ?? 'unknown',
      mode: parsed.mode ?? 'unknown',
      settingsCount: parsed.settings?.length ?? 0,
      secretCount,
      workspaceCounts
    };
  } catch {
    return null;
  }
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="state-card inbox-state-card" data-state="empty">
      <p className="eyebrow">Workspace state</p>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="state-card error inbox-state-card inbox-state-card-error" data-state="error">
      <p className="eyebrow">Attention needed</p>
      <h3>Unable to load workspace</h3>
      <p>{message}</p>
    </div>
  );
}

type StakeholderContact = NonNullable<InboxWorkspaceViewModel['accountDetails']>['contacts'][number];

function buildStakeholderLanes(contacts: StakeholderContact[]) {
  const lanes = [
    { key: 'executive', label: 'Executive', contacts: [] as StakeholderContact[] },
    { key: 'director', label: 'Director', contacts: [] as StakeholderContact[] },
    { key: 'manager-other', label: 'Manager / Other', contacts: [] as StakeholderContact[] },
    { key: 'unclassified', label: 'Unclassified', contacts: [] as StakeholderContact[] }
  ];

  for (const contact of contacts ?? []) {
    const seniority = (contact.seniorityBucket ?? '').trim().toLowerCase();

    if (seniority === 'executive') {
      lanes[0].contacts.push(contact);
      continue;
    }

    if (seniority === 'director') {
      lanes[1].contacts.push(contact);
      continue;
    }

    if (seniority === 'manager' || seniority === 'other') {
      lanes[2].contacts.push(contact);
      continue;
    }

    lanes[3].contacts.push(contact);
  }

  return lanes;
}