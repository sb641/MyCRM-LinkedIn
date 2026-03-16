'use client';

import { useState } from 'react';
import { DeleteIgnoreModal } from '@/components/crm/modals/delete-ignore-modal';

type DraftActionsProps = {
  draftId: string;
  draftStatus: string;
  approvedText: string | null;
  goalText: string;
  conversationId: string;
  accountId: string;
  contactId: string;
  contactName: string;
  provider?: string;
  onSuccess?: () => void;
};

export function DraftActions({
  draftId,
  draftStatus,
  approvedText,
  goalText,
  conversationId,
  accountId,
  contactId,
  contactName,
  provider = 'linkedin-browser',
  onSuccess
}: DraftActionsProps) {
  const [draftText, setDraftText] = useState(approvedText ?? goalText);
  const [isApproving, setIsApproving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isIgnoreModalOpen, setIsIgnoreModalOpen] = useState(false);

  async function handleApprove() {
    setMessage(null);
    setError(null);
    setIsApproving(true);

    try {
      const response = await fetch(`/api/drafts/${encodeURIComponent(draftId)}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          approvedText: draftText,
          sendStatus: 'queued'
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? body.error?.message ?? 'Unable to approve draft');
      }

      setMessage('Draft approved');
      onSuccess?.();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Unable to approve draft');
    } finally {
      setIsApproving(false);
    }
  }

  async function handleSend() {
    setMessage(null);
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch(`/api/drafts/${encodeURIComponent(draftId)}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          draftId,
          conversationId,
          accountId,
          provider
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message ?? body.error?.message ?? 'Unable to queue send');
      }

      setMessage(`Queued send for ${body.jobId ?? draftId}`);
      onSuccess?.();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to queue send');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="draft-actions-block">
      <label className="draft-goal-field">
        <span className="eyebrow">Edit approved text</span>
        <textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} rows={4} />
      </label>
      <div className="quick-action-row">
        {draftStatus !== 'approved' ? (
          <button className="ghost-button" type="button" onClick={handleApprove} disabled={isApproving || !draftText.trim()}>
            {isApproving ? 'Approving...' : 'Approve'}
          </button>
        ) : null}
        <button className="ghost-button" type="button" onClick={() => setIsIgnoreModalOpen(true)}>
          Ignore Person
        </button>
        <button className="accent-button" type="button" onClick={handleSend} disabled={isSending || draftStatus !== 'approved'}>
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
      {message ? <p className="generated-draft-preview">{message}</p> : null}
      {error ? <p className="generated-draft-error">{error}</p> : null}
      <DeleteIgnoreModal
        isOpen={isIgnoreModalOpen}
        contactId={contactId}
        contactName={contactName}
        onClose={() => setIsIgnoreModalOpen(false)}
        onSuccess={onSuccess}
      />
    </div>
  );
}