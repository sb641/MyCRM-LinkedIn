'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { FeatureFlags } from '@mycrm/core';
import type { ShellDataState } from '@/lib/crm-shell';
import { BulkDraftModal, type BulkDraftSelection } from '@/components/crm/modals/bulk-draft-modal';
import { ReminderModal } from '@/components/crm/modals/reminder-modal';
import { ReminderBadge } from '@/components/crm/shared/reminder-badge';
import type { InboxWorkspaceViewModel } from '@/lib/view-models/inbox';

const WORKSPACE_REPLACE_CONFIRMATION = 'REPLACE WORKSPACE';

type InboxWorkspaceProps = {
  state: ShellDataState;
  workspace: InboxWorkspaceViewModel;
  flags: FeatureFlags;
};

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

  const restorePreview = getRestorePreview(backupPayload);
  const isAccountsMode = workspace.entityMode === 'accounts';
  const selectedAccountId = workspace.accountDetails?.account.id ?? workspace.selectedAccount?.id ?? null;
  const assignableContacts = state.inbox.filter((item) => item.accountId !== selectedAccountId);
  const mergeCandidates = workspace.visibleAccounts.filter((account) => account.id !== selectedAccountId);
  const stakeholderLanes = workspace.accountDetails ? buildStakeholderLanes(workspace.accountDetails.contacts) : [];

  function refreshWorkspace(nextAccountId?: string | null) {
    const query = buildQueryParams(searchParams, {
      entity: workspace.entityMode,
      queue: workspace.activeQueue,
      sort: state.sort,
      accountId: nextAccountId ?? selectedAccountId,
      contactId: workspace.selectedItem?.contactId ?? state.selectedItem?.contactId,
      conversationId: workspace.selectedItem?.conversationId ?? state.selectedItem?.conversationId
    });

    const nextUrl = `${pathname}?${query.toString()}`;

    window.location.assign(nextUrl);
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

  const selectedPeople: BulkDraftSelection[] = workspace.visibleItems
    .filter((item) => selectedConversationIds.includes(item.conversationId))
    .map((item) => ({
      contactId: item.contactId,
      conversationId: item.conversationId,
      contactName: item.contactName,
      company: item.company ?? null
    }));

  async function handleManualSync() {
    const accountId = syncAccountId.trim() || defaultAccountId;
    setSyncMessage(null);
    setSyncError(null);
    setIsSyncing(true);

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
        throw new Error(body.message ?? body.error?.message ?? 'Unable to queue sync');
      }

      setSyncMessage(`Sync queued for ${body.jobId ?? body.job?.id ?? 'queued job'}`);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unable to queue sync');
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
      refreshWorkspace(body.account.id);
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
      refreshWorkspace(selectedAccountId);
    } catch (error) {
      setAccountActionError(error instanceof Error ? error.message : 'Unable to assign contacts');
    } finally {
      setIsAssigningContacts(false);
    }
  }

  async function handleMergeAccounts() {
    if (!selectedAccountId || !mergeSourceAccountId) {
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
          sourceAccountId: mergeSourceAccountId,
          targetAccountId: selectedAccountId
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? body.error?.message ?? 'Unable to merge accounts');
      }

      setAccountActionMessage(`Merged ${mergeSourceAccountId} into ${body.account.name}`);
      setMergeSourceAccountId('');
      refreshWorkspace(selectedAccountId);
    } catch (error) {
      setAccountActionError(error instanceof Error ? error.message : 'Unable to merge accounts');
    } finally {
      setIsMergingAccounts(false);
    }
  }

  async function handleSaveReminder(input: { dueAt: number; note: string }) {
    const entityType = isAccountsMode ? 'account' : 'contact';
    const entityId = isAccountsMode
      ? workspace.accountDetails?.account.id ?? workspace.selectedAccount?.id
      : workspace.details?.contact.id ?? workspace.selectedItem?.contactId;

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
    refreshWorkspace(selectedAccountId);
  }

  async function handleCompleteReminder() {
    const entityType = isAccountsMode ? 'account' : 'contact';
    const entityId = isAccountsMode
      ? workspace.accountDetails?.account.id ?? workspace.selectedAccount?.id
      : workspace.details?.contact.id ?? workspace.selectedItem?.contactId;

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
      refreshWorkspace(selectedAccountId);
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : 'Unable to complete reminder');
    }
  }

  return (
    <main className="crm-page">
      <div className="crm-backdrop" />
      <div className="crm-shell inbox-workspace-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Inbox</p>
            <h1 className="hero-title">Daily operating workspace</h1>
            <p className="hero-copy">Work the queue by people or accounts, keep context visible, and preserve manual approval for every outbound message.</p>
          </div>
          <div className="topbar-actions" aria-label="Top bar actions">
            <button className="ghost-button" type="button" onClick={handleManualSync} disabled={isSyncing}>
              {isSyncing ? 'Syncing conversations...' : 'Sync Conversations'}
            </button>
            <button className="ghost-button" type="button" onClick={() => setIsReminderModalOpen(true)}>
              Set reminder
            </button>
            <button className="ghost-button" type="button" onClick={handleCompleteReminder}>
              Complete reminder
            </button>
            <button className="ghost-button" type="button">New note</button>
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
        </header>

        <section className="inbox-queue-bar panel">
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
          <div className="inbox-toolbar-meta">
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
          </div>
        </section>

        <div className="workspace-grid inbox-workspace-grid">
          <aside className="panel sidebar-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Queue</p>
                <h2 className="panel-title">{workspace.entityMode === 'people' ? 'People' : 'Accounts'}</h2>
              </div>
              <div className="panel-header-actions">
                <span className="subtle-pill">Visible {isAccountsMode ? workspace.summary.visibleAccounts : workspace.summary.visibleConversations}</span>
                <span className="count-pill">{isAccountsMode ? workspace.summary.totalAccounts : workspace.summary.totalConversations}</span>
                {selectedPeople.length > 0 && !isAccountsMode ? (
                  <button className="ghost-button" type="button" onClick={clearConversationSelection}>
                    Clear selection
                  </button>
                ) : null}
              </div>
            </div>

            {state.view === 'empty' ? (
              <EmptyState title="Inbox is empty" body="Run a sync or seed more fixtures to populate the queue." />
            ) : isAccountsMode ? (
              workspace.visibleAccounts.length === 0 ? (
                <EmptyState title="No accounts in this queue" body="Create an account or assign contacts to start grouping stakeholders." />
              ) : (
                <nav className="conversation-list" aria-label="Account list">
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
                        className={isActive ? 'conversation-card active' : 'conversation-card'}
                      >
                        <div className="conversation-row conversation-row-selectable">
                          <strong>{account.name}</strong>
                          <span className="subtle-pill">{account.relativeUpdatedAt}</span>
                        </div>
                        <p className="conversation-meta">
                          {account.domain ?? 'No domain'} · {account.relationshipLabel}
                        </p>
                        <p className="conversation-preview">{account.notes?.trim() || 'No account notes yet'}</p>
                        <div className="chip-row" aria-label="Account badges">
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
            ) : workspace.visibleItems.length === 0 ? (
              <EmptyState title="No conversations in this queue" body="Switch queue tabs or sync more data to continue." />
            ) : (
              <nav className="conversation-list" aria-label="Conversation list">
                {workspace.visibleItems.map((item) => {
                  const isActive = workspace.selectedItem?.contactId === item.contactId;

                  return (
                    <Link
                      key={item.conversationId}
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
                      className={isActive ? 'conversation-card active' : 'conversation-card'}
                    >
                      <div className="conversation-row conversation-row-selectable">
                        <label className="conversation-select-toggle" onClick={(event) => event.preventDefault()}>
                          <input
                            type="checkbox"
                            checked={selectedConversationIds.includes(item.conversationId)}
                            onChange={() => toggleConversationSelection(item.conversationId)}
                            aria-label={`Select ${item.contactName}`}
                          />
                        </label>
                        <strong>{workspace.entityMode === 'accounts' ? item.company ?? item.contactName : item.contactName}</strong>
                        <span className="subtle-pill">{item.relativeLastMessage}</span>
                      </div>
                      <p className="conversation-meta">{item.company ?? 'Independent'} · {item.headline ?? 'No headline yet'}</p>
                      <p className="conversation-preview">{item.lastMessageText ?? 'No messages yet'}</p>
                      <div className="chip-row" aria-label="Conversation badges">
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
                    </Link>
                  );
                })}
              </nav>
            )}
          </aside>

          <section className="panel main-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Workspace</p>
                <h2 className="panel-title">{isAccountsMode ? 'Account workspace' : 'Conversation and drafts'}</h2>
              </div>
              <span className="subtle-pill">{isAccountsMode ? 'ABM grouping' : 'Queue-first'}</span>
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
                    <section className="message-stack" aria-label="Stakeholders">
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

                    <section className="draft-stack" aria-label="Account aliases">
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
                      <select value={mergeSourceAccountId} onChange={(event) => setMergeSourceAccountId(event.target.value)}>
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
                      disabled={!selectedAccountId || !mergeSourceAccountId || isMergingAccounts}
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
              <div className="timeline-layout inbox-main-layout">
                <section className="contact-summary">
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

                <div className="inbox-content-columns">
                  <section className="message-stack" aria-label="Conversation history">
                    {workspace.details.messages.length === 0 ? (
                      <EmptyState title="No messages yet" body="This queue item has no synced message history yet." />
                    ) : (
                      workspace.details.messages.map((message) => (
                        <article
                          key={message.id}
                          className={message.isInbound ? 'message-card inbound' : 'message-card outbound'}
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

                  <section className="draft-stack" aria-label="Draft history">
                    <div className="conversation-row">
                      <h3>Drafts</h3>
                      <span className="subtle-pill">{workspace.details.drafts.length}</span>
                    </div>
                    <div className="draft-generator-card">
                      <label className="draft-goal-field">
                        <span className="eyebrow">What should this message achieve?</span>
                        <textarea value={draftGoal} onChange={(event) => setDraftGoal(event.target.value)} rows={3} />
                      </label>
                      <button className="accent-button" type="button" onClick={handleGenerateDraft} disabled={isGenerating}>
                        {isGenerating ? 'Generating draft...' : 'Generate Draft'}
                      </button>
                      {generatedDraft ? <p className="generated-draft-preview">{generatedDraft}</p> : null}
                      {generationError ? <p className="generated-draft-error">{generationError}</p> : null}
                    </div>
                    {workspace.details.drafts.length === 0 ? (
                      <EmptyState title="No drafts yet" body="Generate a draft or wait for the next AI suggestion." />
                    ) : (
                      workspace.details.drafts.map((draft) => (
                        <article key={draft.id} className="draft-card">
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
                </div>
              </div>
            )}
          </section>

          <aside className="panel side-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Context</p>
                <h2 className="panel-title">Signals and operations</h2>
              </div>
            </div>

            <div className="stack-card">
              <div className="conversation-row">
                <p className="eyebrow">Queue summary</p>
                <span className="subtle-pill">Phase 02</span>
              </div>
              <dl className="flag-list">
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

            <dl className="flag-list">
              <div>
                <dt>AI</dt>
                <dd>{String(flags.ENABLE_AI)}</dd>
              </div>
              <div>
                <dt>Automation</dt>
                <dd>{String(flags.ENABLE_AUTOMATION)}</dd>
              </div>
              <div>
                <dt>Real browser sync</dt>
                <dd>{String(flags.ENABLE_REAL_BROWSER_SYNC)}</dd>
              </div>
              <div>
                <dt>Real send</dt>
                <dd>{String(flags.ENABLE_REAL_SEND)}</dd>
              </div>
            </dl>

            <div className="stack-card">
              <p className="eyebrow">LinkedIn Connection</p>
              {state.browserSession ? (
                <div className="sync-session-summary" aria-label="Saved browser session">
                  <p>{state.browserSession.statusLabel}</p>
                  <p className="conversation-meta">{state.browserSession.accountId}</p>
                  <p className="conversation-meta">Captured {state.browserSession.capturedAtLabel}</p>
                  <p className="conversation-meta">{state.browserSession.userAgentLabel}</p>
                </div>
              ) : (
                <p className="stack-copy">No saved LinkedIn connection yet. Capture one before running a real browser sync.</p>
              )}
              <label className="draft-goal-field">
                <span>Account ID</span>
                <input value={syncAccountId} onChange={(event) => setSyncAccountId(event.target.value)} />
              </label>
              <button className="accent-button" type="button" onClick={handleManualSync} disabled={isSyncing}>
                {isSyncing ? 'Syncing conversations...' : 'Sync Conversations'}
              </button>
              {syncMessage ? <p className="generated-draft-preview">{syncMessage}</p> : null}
              {syncError ? <p className="generated-draft-error">{syncError}</p> : null}
            </div>

            <div className="stack-card">
              <div className="conversation-row">
                <p className="eyebrow">Sync in Progress</p>
                <button className="ghost-button" type="button" onClick={() => window.location.reload()}>
                  Refresh
                </button>
              </div>
              {state.activeSyncJob ? (
                <>
                  <p>{state.activeSyncJob.statusLabel}</p>
                  <p className="conversation-meta">{state.activeSyncJob.accountId} · {state.activeSyncJob.provider}</p>
                  <p className="conversation-meta">Updated {state.activeSyncJob.relativeUpdatedAt}</p>
                  <p className="conversation-meta">Audit entries: {state.activeSyncJob.auditCount}</p>
                  {state.activeSyncJob.operatorMessage ? <p className="stack-copy">{state.activeSyncJob.operatorMessage}</p> : null}
                  {state.activeSyncJob.lastError ? <p className="generated-draft-error">{state.activeSyncJob.lastError}</p> : null}
                </>
              ) : (
                <p className="stack-copy">No queued or running sync jobs.</p>
              )}
            </div>

            <div className="stack-card">
              <div className="conversation-row">
                <p className="eyebrow">Sync History</p>
                <span className="subtle-pill">{state.syncRuns.length}</span>
              </div>
              {state.syncRuns.length === 0 ? (
                <p className="stack-copy">No sync runs recorded yet.</p>
              ) : (
                <div className="sync-run-list" aria-label="Sync history">
                  {state.syncRuns.map((syncRun) => (
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
              )}
            </div>

            <div className="stack-card">
              <div className="conversation-row">
                <p className="eyebrow">Settings</p>
                <span className="subtle-pill">Workspace</span>
              </div>
              <div className="stack-copy" aria-label="Settings operator guidance">
                Export creates a workspace snapshot without secrets. Restore expects a valid snapshot payload. Use Reset secret when a stored token should be cleared on the next save.
              </div>
              <div className="settings-list" aria-label="Workspace settings">
                {state.settings.map((entry) => (
                  <div key={entry.key} className="draft-goal-field">
                    <span>{entry.key}</span>
                    <input
                      aria-label={entry.key}
                      type={entry.isSecret ? 'password' : 'text'}
                      placeholder={entry.redactedValue ?? ''}
                      value={settingsValues[entry.key] ?? ''}
                      disabled={Boolean(settingsReset[entry.key])}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSettingsValues((current) => ({
                          ...current,
                          [entry.key]: nextValue
                        }));

                        if (entry.isSecret && nextValue.length > 0) {
                          setSettingsReset((current) => ({
                            ...current,
                            [entry.key]: false
                          }));
                        }
                      }}
                    />
                    {entry.isSecret ? (
                      <div className="quick-action-row">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => {
                            setSettingsValues((current) => ({
                              ...current,
                              [entry.key]: ''
                            }));
                            setSettingsReset((current) => ({
                              ...current,
                              [entry.key]: !current[entry.key]
                            }));
                          }}
                        >
                          {settingsReset[entry.key] ? 'Keep secret' : 'Reset secret'}
                        </button>
                        {settingsReset[entry.key] ? <span className="conversation-meta">Secret will be cleared on save</span> : <span className="conversation-meta">Leave blank to keep the stored secret</span>}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="quick-action-row">
                <button className="accent-button" type="button" onClick={handleSaveSettings} disabled={isSavingSettings}>
                  {isSavingSettings ? 'Saving...' : 'Save settings'}
                </button>
                <button className="ghost-button" type="button" onClick={handleExportBackup}>
                  Export Workspace Data
                </button>
              </div>
              <label className="draft-goal-field">
                <span>Restore workspace payload</span>
                <textarea value={backupPayload} onChange={(event) => setBackupPayload(event.target.value)} rows={8} />
              </label>
              {restorePreview ? (
                <div className="stack-card" aria-label="Restore payload preview">
                  <p className="eyebrow">Restore preview</p>
                  <p className="stack-copy">
                    Scope: <strong>{restorePreview.scope}</strong> · Mode: <strong>{restorePreview.mode}</strong> · Settings: <strong>{restorePreview.settingsCount}</strong> · Secret entries: <strong>{restorePreview.secretCount}</strong>
                  </p>
                  {restorePreview.workspaceCounts.length > 0 ? (
                    <dl className="flag-list">
                      {restorePreview.workspaceCounts.map((entry) => (
                        <div key={entry.label}>
                          <dt>{entry.label}</dt>
                          <dd>{entry.count}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <p className="stack-copy">
                    Review scope, mode, and record counts before restore. Replace overwrites current workspace data; merge keeps existing rows and upserts matching ids.
                  </p>
                </div>
              ) : backupPayload.trim() ? (
                <p className="generated-draft-error">Restore preview unavailable until the payload is valid JSON</p>
              ) : null}
              <label className="draft-goal-field">
                <span>Workspace replace confirmation</span>
                <input
                  aria-label="Workspace replace confirmation"
                  type="text"
                  placeholder={WORKSPACE_REPLACE_CONFIRMATION}
                  value={restoreConfirmation}
                  onChange={(event) => setRestoreConfirmation(event.target.value)}
                />
              </label>
              <p className="stack-copy">
                Workspace restore with <strong>replace</strong> overwrites contacts, conversations, messages, drafts, jobs, sync runs, audit log, and settings. Type {WORKSPACE_REPLACE_CONFIRMATION} before running that restore mode.
              </p>
              <button className="ghost-button" type="button" onClick={handleImportBackup} disabled={!backupPayload.trim()}>
                Restore Workspace Data
              </button>
              {settingsMessage ? <p className="generated-draft-preview">{settingsMessage}</p> : null}
              {settingsError ? <p className="generated-draft-error">{settingsError}</p> : null}
            </div>
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
    <div className="state-card" data-state="empty">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="state-card error" data-state="error">
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