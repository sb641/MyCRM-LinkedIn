'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { ShellDataState } from '@/lib/crm-shell';

const WORKSPACE_REPLACE_CONFIRMATION = 'REPLACE WORKSPACE';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function countArrayEntries(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

type CrmShellProps = {
  state: ShellDataState;
  flags: {
    ENABLE_AI: boolean;
    ENABLE_AUTOMATION: boolean;
    ENABLE_REAL_BROWSER_SYNC: boolean;
    ENABLE_REAL_SEND: boolean;
  };
};

export function CrmShell({ state, flags }: CrmShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftGoal, setDraftGoal] = useState('Follow up on our last conversation');
  const [generatedDraft, setGeneratedDraft] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isQueueingSend, setIsQueueingSend] = useState<string | null>(null);
  const [sendMessage, setSendMessage] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [syncAccountId, setSyncAccountId] = useState('local-account');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [settingsValues, setSettingsValues] = useState<Record<string, string>>(
    Object.fromEntries(state.settings.map((entry) => [entry.key, entry.isSecret ? '' : entry.value]))
  );
  const [settingsReset, setSettingsReset] = useState<Record<string, boolean>>(
    Object.fromEntries(state.settings.map((entry) => [entry.key, false]))
  );
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [backupPayload, setBackupPayload] = useState<string>('');
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const sortOptions = [
    { value: 'recent', label: 'Recent' },
    { value: 'needs-attention', label: 'Needs attention' },
    { value: 'name', label: 'Name' }
  ] as const;

  let restorePreview: {
    scope: 'settings' | 'workspace';
    mode: string;
    settingsCount: number;
    secretCount: number;
    workspaceCounts: Array<{ label: string; count: number }>;
  } | null = null;

  if (backupPayload.trim()) {
    try {
      const parsed = JSON.parse(backupPayload) as unknown;

      if (isRecord(parsed)) {
        const scope = parsed.scope === 'workspace' ? 'workspace' : 'settings';
        const settingsEntries = Array.isArray(parsed.settings)
          ? parsed.settings
          : Array.isArray(parsed.values)
            ? parsed.values
            : [];
        const secretCount = settingsEntries.filter(
          (entry) => isRecord(entry) && entry.isSecret === true
        ).length;
        const workspaceData = isRecord(parsed.data) ? parsed.data : null;

        restorePreview = {
          scope,
          mode: typeof parsed.mode === 'string' ? parsed.mode : scope === 'workspace' ? 'replace' : 'merge',
          settingsCount: settingsEntries.length,
          secretCount,
          workspaceCounts: workspaceData
            ? [
                { label: 'Contacts', count: countArrayEntries(workspaceData.contacts) },
                { label: 'Conversations', count: countArrayEntries(workspaceData.conversations) },
                { label: 'Messages', count: countArrayEntries(workspaceData.messages) },
                { label: 'Drafts', count: countArrayEntries(workspaceData.drafts) },
                { label: 'Jobs', count: countArrayEntries(workspaceData.jobs) },
                { label: 'Sync runs', count: countArrayEntries(workspaceData.syncRuns) },
                { label: 'Audit log', count: countArrayEntries(workspaceData.auditLog) }
              ]
            : []
        };
      }
    } catch {
      restorePreview = null;
    }
  }

  async function handleGenerateDraft() {
    if (!state.details) {
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const response = await fetch('/api/drafts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contactId: state.details.contact.id,
          conversationId: state.details.conversation.id,
          goal: draftGoal
        })
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? 'Draft generation failed');
      }

      setGeneratedDraft(body.variants[0]?.text ?? null);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Draft generation failed');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleManualSync() {
    setIsSyncing(true);
    setSyncMessage(null);
    setSyncError(null);

    try {
      const response = await fetch('/api/jobs?mode=manual-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accountId: syncAccountId,
          provider: 'linkedin-browser'
        })
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? 'Manual sync enqueue failed');
      }

      setSyncMessage(`Manual sync queued: ${body.jobId}`);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Manual sync enqueue failed');
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleQueueSend(draftId: string) {
    if (!state.details) {
      return;
    }

    setIsQueueingSend(draftId);
    setSendMessage(null);
    setSendError(null);

    try {
      const response = await fetch(`/api/drafts/${draftId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId: state.details.conversation.id,
          accountId: syncAccountId,
          provider: 'linkedin-browser'
        })
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? 'Unable to queue send');
      }

      setSendMessage(`Queued send for ${body.jobId}`);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Unable to queue send');
    } finally {
      setIsQueueingSend(null);
    }
  }

  async function handleSaveSettings() {
    setIsSavingSettings(true);
    setSettingsMessage(null);
    setSettingsError(null);

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

  return (
    <main className="crm-page">
      <div className="crm-backdrop" />
      <div className="crm-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Inbox</p>
            <h1 className="hero-title">People-first outreach workspace</h1>
            <p className="hero-copy">Work conversations, review AI drafts, and keep every outbound message under manual control from one desktop-first workspace.</p>
          </div>
          <div className="topbar-actions" aria-label="Top bar actions">
            <button className="ghost-button" type="button" onClick={handleManualSync} disabled={isSyncing}>
              {isSyncing ? 'Syncing conversations...' : 'Sync Conversations'}
            </button>
            <button className="ghost-button" type="button">New note</button>
            <button className="accent-button" type="button" onClick={handleGenerateDraft} disabled={!state.details || isGenerating}>
              {isGenerating ? 'Generating draft...' : 'Generate Draft'}
            </button>
          </div>
        </header>

        <div className="workspace-grid">
          <aside className="panel sidebar-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Inbox</p>
                <h2 className="panel-title">Conversations</h2>
              </div>
              <div className="panel-header-actions">
                <label className="sort-select-label">
                  <span>Sort</span>
                  <select
                    aria-label="Sort conversations"
                    className="sort-select"
                    value={state.sort}
                    onChange={(event) => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set('sort', event.target.value);
                      window.location.assign(`${pathname}?${params.toString()}`);
                    }}
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="count-pill">{state.inbox.length}</span>
              </div>
            </div>

            {state.view === 'empty' ? (
              <EmptyState
                title="Inbox is empty"
                body="Run a sync or seed more fixtures to populate the left rail."
              />
            ) : (
              <nav className="conversation-list" aria-label="Conversation list">
                {state.inbox.map((item) => {
                  const href = {
                    pathname,
                    query: {
                      contactId: item.contactId,
                      conversationId: item.conversationId,
                      sort: state.sort
                    }
                  };
                  const isActive = state.selectedItem?.contactId === item.contactId;

                  return (
                    <Link
                      key={item.conversationId}
                      href={href}
                      className={isActive ? 'conversation-card active' : 'conversation-card'}
                    >
                      <div className="conversation-row">
                        <strong>{item.contactName}</strong>
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
                      </div>
                      <div className="quick-action-row" aria-label="Conversation quick actions">
                        {item.quickActions.map((action) => (
                          <button
                            key={`${item.conversationId}-${action.label}`}
                            className={`mini-action intent-${action.intent}`}
                            type="button"
                          >
                            {action.label}
                          </button>
                        ))}
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
                <p className="eyebrow">Conversation</p>
                <h2 className="panel-title">Timeline</h2>
              </div>
              <span className="subtle-pill">Route-driven</span>
            </div>

            {state.view === 'error' ? (
              <ErrorState message={state.errorMessage ?? 'Unknown error'} />
            ) : state.view === 'empty' ? (
              <EmptyState
                title="No conversation selected"
                body="Once inbox data exists, the first conversation will be selected automatically."
              />
            ) : state.details ? (
              <div className="timeline-layout">
                <section className="contact-summary">
                  <h3>{state.details.contact.name}</h3>
                  <p>{state.details.contact.company ?? 'Independent'} · {state.details.contact.headline ?? 'No headline yet'}</p>
                  <div className="summary-chips" aria-label="Contact badges">
                    {state.details.contact.badges.map((badge) => (
                      <span key={badge.label} className={`status-chip tone-${badge.tone}`}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                  <dl className="contact-facts">
                    <div>
                      <dt>Relationship</dt>
                      <dd>{state.details.contact.relationshipLabel}</dd>
                    </div>
                    <div>
                      <dt>Last activity</dt>
                      <dd>{state.details.contact.lastInteractionLabel}</dd>
                    </div>
                    <div>
                      <dt>Next step</dt>
                      <dd>{state.details.contact.nextStepLabel}</dd>
                    </div>
                    <div>
                      <dt>Follow-up</dt>
                      <dd>{state.details.contact.followupDueLabel}</dd>
                    </div>
                  </dl>
                  {state.details.contact.followupUrgency !== 'none' ? (
                    <div className={`followup-callout urgency-${state.details.contact.followupUrgency}`}>
                      <strong>{state.details.contact.followupDueLabel}</strong>
                      <p>{state.details.contact.nextStepLabel}</p>
                    </div>
                  ) : null}
                  <div className="quick-action-row" aria-label="Contact quick actions">
                    {state.details.contact.quickActions.map((action) => (
                      <button key={action.label} className={`mini-action intent-${action.intent}`} type="button">
                        {action.label}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="message-stack" aria-label="Conversation history">
                  {state.details.messages.length === 0 ? (
                    <EmptyState
                      title="No messages yet"
                      body="Phase 4 will turn this into the full conversation history view."
                    />
                  ) : (
                    state.details.messages.map((message) => (
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
                    <span className="subtle-pill">{state.details.drafts.length}</span>
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
                  {state.details.drafts.length === 0 ? (
                    <EmptyState title="No drafts yet" body="Phase 5 will add AI generation and review flows here." />
                  ) : (
                    state.details.drafts.map((draft) => (
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
                            onClick={() => handleQueueSend(draft.id)}
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
                </section>
              </div>
            ) : (
              <LoadingState />
            )}
          </section>

          <aside className="panel side-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Workspace</p>
                <h2 className="panel-title">Flags and actions</h2>
              </div>
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
              <p className="eyebrow">CRM model</p>
              <p className="stack-copy">Selection stays URL-driven, while badges, timestamps, priority, and quick actions are derived in a presentation layer so Phase 5 can reuse the same shell.</p>
            </div>

            <div className="stack-card">
              <div className="conversation-row">
                <p className="eyebrow">Settings</p>
                <span className="subtle-pill">Phase 11</span>
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

            <div className="stack-card">
              <p className="eyebrow">LinkedIn Connection</p>
              {state.linkedInSyncReadiness ? (
                <div className="sync-session-summary" aria-label="LinkedIn sync readiness">
                  <p>
                    <span className={`status-chip tone-${state.linkedInSyncReadiness.tone}`}>
                      {state.linkedInSyncReadiness.statusLabel}
                    </span>
                  </p>
                  <p className="stack-copy">{state.linkedInSyncReadiness.message}</p>
                  <dl className="flag-list">
                    <div>
                      <dt>Feature flag</dt>
                      <dd>{String(state.linkedInSyncReadiness.checks.enableRealBrowserSync)}</dd>
                    </div>
                    <div>
                      <dt>CDP URL</dt>
                      <dd>{String(state.linkedInSyncReadiness.checks.hasCdpUrl)}</dd>
                    </div>
                    <div>
                      <dt>User profile</dt>
                      <dd>{String(state.linkedInSyncReadiness.checks.hasUserDataDir)}</dd>
                    </div>
                    <div>
                      <dt>Saved session</dt>
                      <dd>{String(state.linkedInSyncReadiness.checks.hasSavedSession)}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}
              {state.browserSession ? (
                <div className="sync-session-summary" aria-label="Saved browser session">
                  <p>{state.browserSession.statusLabel}</p>
                  <p className="stack-copy">{state.browserSession.detailLabel}</p>
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
          </aside>
        </div>
      </div>
    </main>
  );
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

function LoadingState() {
  return (
    <div className="state-card" data-state="loading">
      <h3>Loading conversation</h3>
      <p>Route selection is ready, but the conversation payload has not arrived yet.</p>
    </div>
  );
}