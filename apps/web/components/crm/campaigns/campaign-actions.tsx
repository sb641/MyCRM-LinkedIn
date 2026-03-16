'use client';

import { useState } from 'react';
import type { InboxItemDto } from '@mycrm/core';

type CampaignActionsProps = {
  campaignId?: string;
  availableTargets?: InboxItemDto[];
  assignedContactIds?: string[];
};

export function CampaignActions({
  campaignId,
  availableTargets = [],
  assignedContactIds = []
}: CampaignActionsProps) {
  const [createName, setCreateName] = useState('');
  const [createObjective, setCreateObjective] = useState('');
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [status, setStatus] = useState('draft');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleTarget(contactId: string) {
    setSelectedTargetIds((current) =>
      current.includes(contactId)
        ? current.filter((value) => value !== contactId)
        : [...current, contactId]
    );
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName, objective: createObjective, status })
      });

      if (!response.ok) {
        throw new Error('Failed to create campaign');
      }

      const body = await response.json();
      setMessage(`Created ${body.campaign.name}`);
      setCreateName('');
      setCreateObjective('');
      window.location.href = `/campaigns/${body.campaign.id}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddTargets(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignId) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: selectedTargetIds })
      });

      if (!response.ok) {
        throw new Error('Failed to add targets');
      }

      setMessage('Targets updated');
      setSelectedTargetIds([]);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to add targets');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(nextStatus: string) {
    if (!campaignId) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update campaign');
      }

      setMessage(`Status updated to ${nextStatus}`);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update campaign');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="campaign-actions-stack">
      {!campaignId ? (
        <form className="panel campaign-form" onSubmit={handleCreate}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">New campaign</p>
              <h2 className="panel-title">Create a single-action outreach plan</h2>
            </div>
          </div>
          <label className="crm-field">
            <span>Name</span>
            <input value={createName} onChange={(event) => setCreateName(event.target.value)} required />
          </label>
          <label className="crm-field">
            <span>Objective</span>
            <textarea value={createObjective} onChange={(event) => setCreateObjective(event.target.value)} rows={3} required />
          </label>
          <label className="crm-field">
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <div className="quick-action-row">
            <button className="accent-button" type="submit" disabled={isSubmitting}>
              Create campaign
            </button>
          </div>
          {message ? <p className="campaign-inline-message">{message}</p> : null}
        </form>
      ) : (
        <>
          <section className="panel campaign-form">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Campaign controls</p>
                <h2 className="panel-title">Update status</h2>
              </div>
            </div>
            <div className="quick-action-row">
              <button className="ghost-button" type="button" disabled={isSubmitting} onClick={() => handleStatusChange('draft')}>
                Mark draft
              </button>
              <button className="ghost-button" type="button" disabled={isSubmitting} onClick={() => handleStatusChange('active')}>
                Mark active
              </button>
              <button className="ghost-button" type="button" disabled={isSubmitting} onClick={() => handleStatusChange('paused')}>
                Pause
              </button>
              <button className="ghost-button" type="button" disabled={isSubmitting} onClick={() => handleStatusChange('completed')}>
                Complete
              </button>
            </div>
          </section>

          <form className="panel campaign-form" onSubmit={handleAddTargets}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Targeting</p>
                <h2 className="panel-title">Choose inbox contacts</h2>
              </div>
            </div>
            {availableTargets.length === 0 ? (
              <p className="campaign-inline-message">No inbox contacts available to assign yet.</p>
            ) : (
              <div className="campaign-target-picker" role="list">
                {availableTargets.map((target) => {
                  const isAssigned = assignedContactIds.includes(target.contactId);
                  const isSelected = selectedTargetIds.includes(target.contactId);

                  return (
                    <label
                      key={target.contactId}
                      className={`campaign-target-option${isAssigned ? ' is-assigned' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isAssigned || isSelected}
                        disabled={isAssigned || isSubmitting}
                        onChange={() => toggleTarget(target.contactId)}
                      />
                      <div className="campaign-target-meta">
                        <strong>{target.contactName}</strong>
                        <span>{target.company ?? 'Independent'}</span>
                        <span>{target.headline ?? 'No headline'}</span>
                      </div>
                      <div className="campaign-target-context">
                        <span className="subtle-pill">{target.relationshipStatus}</span>
                        {target.accountId ? <span className="subtle-pill">Account {target.accountId}</span> : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="quick-action-row">
              <button
                className="accent-button"
                type="submit"
                disabled={isSubmitting || selectedTargetIds.length === 0}
              >
                Add targets
              </button>
            </div>
            {message ? <p className="campaign-inline-message">{message}</p> : null}
          </form>
        </>
      )}
    </div>
  );
}