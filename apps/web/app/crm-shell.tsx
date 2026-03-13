'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { ShellDataState } from '@/lib/crm-shell';

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
  const sortOptions = [
    { value: 'recent', label: 'Recent' },
    { value: 'needs-attention', label: 'Needs attention' },
    { value: 'name', label: 'Name' }
  ] as const;

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

  return (
    <main className="crm-page">
      <div className="crm-backdrop" />
      <div className="crm-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Phase 6</p>
            <h1 className="hero-title">LinkedIn CRM Workspace</h1>
            <p className="hero-copy">The workspace now highlights follow-up timing, recommends the next outreach step, and keeps draft generation close to the thread.</p>
          </div>
          <div className="topbar-actions" aria-label="Top bar actions">
            <button className="ghost-button" type="button">Sync inbox</button>
            <button className="ghost-button" type="button">New note</button>
            <button className="accent-button" type="button" onClick={handleGenerateDraft} disabled={!state.details || isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate draft'}
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
                      <span className="eyebrow">Draft goal</span>
                      <textarea value={draftGoal} onChange={(event) => setDraftGoal(event.target.value)} rows={3} />
                    </label>
                    <button className="accent-button" type="button" onClick={handleGenerateDraft} disabled={isGenerating}>
                      {isGenerating ? 'Generating...' : 'Generate with mock Gemini'}
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
                      </article>
                    ))
                  )}
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