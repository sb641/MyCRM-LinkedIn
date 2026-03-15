'use client';

import { useEffect, useState } from 'react';

export type BulkDraftSelection = {
  contactId: string;
  conversationId: string;
  contactName: string;
  company: string | null;
};

type BulkDraftModalProps = {
  isOpen: boolean;
  selections: BulkDraftSelection[];
  onClose: () => void;
  onSuccess?: (message: string) => void;
};

export function BulkDraftModal({ isOpen, selections, onClose, onSuccess }: BulkDraftModalProps) {
  const [goal, setGoal] = useState('Book a short intro call and propose a concrete next step.');
  const [includeLink, setIncludeLink] = useState('');
  const [callToAction, setCallToAction] = useState('Reply with a time next week');
  const [tone, setTone] = useState('Concise and warm');
  const [constraints, setConstraints] = useState('Keep it under 80 words.');
  const [useRecentConversationContext, setUseRecentConversationContext] = useState(true);
  const [useAccountContext, setUseAccountContext] = useState(true);
  const [varyMessageByRole, setVaryMessageByRole] = useState(true);
  const [avoidRepeatingAngleWithinAccount, setAvoidRepeatingAngleWithinAccount] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit() {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/drafts/bulk-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selections: selections.map((selection) => ({
            contactId: selection.contactId,
            conversationId: selection.conversationId
          })),
          goal,
          options: {
            includeLink,
            callToAction,
            tone,
            constraints,
            useRecentConversationContext,
            useAccountContext,
            varyMessageByRole,
            avoidRepeatingAngleWithinAccount
          }
        })
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? body.error?.message ?? 'Unable to generate drafts');
      }

      const successMessage = `Generated ${body.generatedCount} drafts for ${body.requestedCount} selected people.`;
      setMessage(successMessage);
      onSuccess?.(successMessage);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to generate drafts');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bulk-draft-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="bulk-draft-modal-title">
      <div className="bulk-draft-modal panel">
        <div className="conversation-row">
          <div>
            <p className="eyebrow">Bulk Draft Generation</p>
            <h2 id="bulk-draft-modal-title" className="panel-title">Generate drafts for selected people</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="bulk-draft-selection-list" aria-label="Selected people">
          {selections.map((selection) => (
            <div key={selection.conversationId} className="bulk-draft-selection-item">
              <strong>{selection.contactName}</strong>
              <span className="conversation-meta">{selection.company ?? 'Independent'}</span>
            </div>
          ))}
        </div>

        <label className="draft-goal-field">
          <span className="eyebrow">What should these messages achieve?</span>
          <textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={3} />
        </label>

        <div className="bulk-draft-form-grid">
          <label className="draft-goal-field">
            <span>Link to include</span>
            <input value={includeLink} onChange={(event) => setIncludeLink(event.target.value)} />
          </label>
          <label className="draft-goal-field">
            <span>Call to action</span>
            <input value={callToAction} onChange={(event) => setCallToAction(event.target.value)} />
          </label>
          <label className="draft-goal-field">
            <span>Tone</span>
            <input value={tone} onChange={(event) => setTone(event.target.value)} />
          </label>
          <label className="draft-goal-field">
            <span>Constraints</span>
            <textarea value={constraints} onChange={(event) => setConstraints(event.target.value)} rows={3} />
          </label>
        </div>

        <div className="bulk-draft-options" aria-label="ABM options">
          <label><input type="checkbox" checked={useRecentConversationContext} onChange={(event) => setUseRecentConversationContext(event.target.checked)} /> Use recent conversation context</label>
          <label><input type="checkbox" checked={useAccountContext} onChange={(event) => setUseAccountContext(event.target.checked)} /> Use account context</label>
          <label><input type="checkbox" checked={varyMessageByRole} onChange={(event) => setVaryMessageByRole(event.target.checked)} /> Vary the message by role</label>
          <label><input type="checkbox" checked={avoidRepeatingAngleWithinAccount} onChange={(event) => setAvoidRepeatingAngleWithinAccount(event.target.checked)} /> Avoid repeating the same angle within the same account</label>
        </div>

        <div className="topbar-actions">
          <button className="ghost-button" type="button" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button className="accent-button" type="button" onClick={handleSubmit} disabled={isSubmitting || selections.length === 0}>
            {isSubmitting ? 'Generating drafts...' : `Generate ${selections.length} Drafts`}
          </button>
        </div>

        {message ? <p className="generated-draft-preview">{message}</p> : null}
        {error ? <p className="generated-draft-error">{error}</p> : null}
      </div>
    </div>
  );
}