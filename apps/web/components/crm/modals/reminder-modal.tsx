'use client';

import { useState } from 'react';

type ReminderModalProps = {
  open: boolean;
  title: string;
  initialDate?: string;
  initialNote?: string;
  onClose: () => void;
  onSubmit: (input: { dueAt: number; note: string }) => Promise<void>;
};

export function ReminderModal({ open, title, initialDate = '', initialNote = '', onClose, onSubmit }: ReminderModalProps) {
  const [dateValue, setDateValue] = useState(initialDate);
  const [noteValue, setNoteValue] = useState(initialNote);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!dateValue) {
      setError('Choose a reminder date and time.');
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({ dueAt: new Date(dateValue).getTime(), note: noteValue.trim() });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save reminder');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="crm-modal-backdrop" role="presentation">
      <div className="crm-modal" role="dialog" aria-modal="true" aria-label={title}>
        <form className="stack-panel" onSubmit={handleSubmit}>
          <div>
            <h3>{title}</h3>
            <p className="stack-copy">Set one active reminder for this record. You can complete or reschedule it later.</p>
          </div>
          <label className="settings-field">
            <span>Due at</span>
            <input type="datetime-local" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
          </label>
          <label className="settings-field">
            <span>Note</span>
            <textarea rows={3} value={noteValue} onChange={(event) => setNoteValue(event.target.value)} />
          </label>
          {error ? <p className="status-banner status-banner--error">{error}</p> : null}
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}