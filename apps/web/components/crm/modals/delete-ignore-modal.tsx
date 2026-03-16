'use client';

import { useEffect, useState } from 'react';
import { ignoreContact } from '@/lib/services/suppressions-service';

type DeleteIgnoreModalProps = {
  isOpen: boolean;
  contactId: string | null;
  contactName: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export function DeleteIgnoreModal({ isOpen, contactId, contactName, onClose, onSuccess }: DeleteIgnoreModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setIsSubmitting(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !contactId) {
    return null;
  }

  async function handleIgnore() {
    if (!contactId) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await ignoreContact(contactId, { reason: reason.trim() });
      onSuccess?.();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to ignore contact');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bulk-draft-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-ignore-modal-title">
      <div className="bulk-draft-modal panel">
        <div className="conversation-row">
          <div>
            <p className="eyebrow">Ignore Forever</p>
            <h2 id="delete-ignore-modal-title" className="panel-title">Remove {contactName} from future syncs</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose} disabled={isSubmitting}>
            Close
          </button>
        </div>
        <p className="conversation-preview">
          This removes the person from the active queue and keeps future syncs from re-importing them until restored from Settings.
        </p>
        <label className="draft-goal-field">
          <span>Reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            placeholder="Optional context for future operators"
          />
        </label>
        <div className="topbar-actions">
          <button className="ghost-button" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="accent-button" type="button" onClick={handleIgnore} disabled={isSubmitting}>
            {isSubmitting ? 'Ignoring...' : 'Ignore Forever'}
          </button>
        </div>
        {error ? <p className="generated-draft-error">{error}</p> : null}
      </div>
    </div>
  );
}