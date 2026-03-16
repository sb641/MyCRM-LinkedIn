'use client';

import { useEffect, useState } from 'react';
import type { SuppressionDto } from '@mycrm/core';
import { listSuppressions, restoreSuppression } from '@/lib/services/suppressions-service';

export function IgnoredPeoplePanel() {
  const [items, setItems] = useState<SuppressionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function loadItems() {
    setIsLoading(true);
    setError(null);

    try {
      setItems(await listSuppressions());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load ignored people');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  async function handleRestore(suppressionId: string) {
    setMessage(null);
    setError(null);
    setRestoringId(suppressionId);

    try {
      await restoreSuppression(suppressionId);
      setMessage('Ignored person restored');
      await loadItems();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Failed to restore ignored person');
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Ignored People</p>
          <h2 className="panel-title">Restore suppressed contacts</h2>
        </div>
        <button className="ghost-button" type="button" onClick={() => void loadItems()} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <p className="conversation-preview">
        Ignored contacts stay excluded from future sync imports until restored here.
      </p>
      {message ? <p className="generated-draft-preview">{message}</p> : null}
      {error ? <p className="generated-draft-error">{error}</p> : null}
      {isLoading ? (
        <p className="conversation-meta">Loading ignored people...</p>
      ) : items.length === 0 ? (
        <p className="conversation-meta">No ignored people right now.</p>
      ) : (
        <div className="sync-run-list" aria-label="Ignored people list">
          {items.map((item) => (
            <article key={item.id} className="draft-card">
              <div className="conversation-row">
                <div>
                  <strong>{item.linkedinProfileId}</strong>
                  <p className="conversation-meta">Contact ID: {item.contactId ?? 'Detached suppression'}</p>
                </div>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => void handleRestore(item.id)}
                  disabled={restoringId === item.id}
                >
                  {restoringId === item.id ? 'Restoring...' : 'Restore'}
                </button>
              </div>
              <p className="conversation-preview">{item.reason?.trim() || 'No reason provided'}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}