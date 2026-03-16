export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { CrmPageFrame } from '@/components/crm/app-shell/crm-page-frame';
import { CampaignActions } from '@/components/crm/campaigns/campaign-actions';
import { getCampaignDetails } from '@/lib/services/campaigns-service';
import { listInboxItems } from '@/lib/services/inbox-service';

type CampaignDetailPageProps = {
  params: Promise<{
    campaignId: string;
  }>;
};

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { campaignId } = await params;
  const [details, inbox] = await Promise.all([getCampaignDetails(campaignId), listInboxItems()]);

  return (
    <CrmPageFrame
      eyebrow="Campaigns"
      title={details.campaign.name}
      description={details.campaign.objective}
      actions={<Link className="ghost-button" href="/campaigns">Back to campaigns</Link>}
    >
      <div className="campaigns-page-grid">
        <CampaignActions
          campaignId={campaignId}
          availableTargets={inbox}
          assignedContactIds={details.targets.map((target) => target.contactId)}
        />
        <div className="campaign-detail-stack">
          <section className="panel campaigns-list-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Overview</p>
                <h2 className="panel-title">Campaign summary</h2>
              </div>
              <span className="status-chip tone-info">{details.campaign.status}</span>
            </div>
            <div className="chip-row">
              <span className="subtle-pill">Targets: {details.targets.length}</span>
              <span className="subtle-pill">Drafts: {details.drafts.length}</span>
              <span className="subtle-pill">Reminders: {details.reminders.length}</span>
            </div>
            <div className="chip-row">
              {details.campaign.tags.length === 0 ? <span className="subtle-pill">No tags</span> : details.campaign.tags.map((tag) => <span key={tag} className="subtle-pill">#{tag}</span>)}
            </div>
            <p className="conversation-preview">{details.campaign.defaultPrompt ?? 'No default prompt yet.'}</p>
          </section>

          <section className="panel campaigns-list-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Targets</p>
                <h2 className="panel-title">Assigned contacts</h2>
              </div>
            </div>
            {details.targets.length === 0 ? (
              <div className="crm-placeholder-card">
                <h3>No targets yet</h3>
                <p>Choose contacts from the control panel to start grouping outreach work.</p>
              </div>
            ) : (
              <div className="campaigns-list">
                {details.targets.map((target) => (
                  <article key={target.id} className="campaign-card">
                    <div className="conversation-row">
                      <div>
                        <h3>{target.contact.name}</h3>
                        <p className="conversation-meta">{target.contact.company ?? 'Independent'} · {target.contact.headline ?? 'No headline'}</p>
                      </div>
                      <span className="subtle-pill">{target.contact.relationshipStatus}</span>
                    </div>
                    <div className="quick-action-row">
                      <form action={`/api/campaigns/${campaignId}/targets/${target.id}`} method="post">
                        <input type="hidden" name="_method" value="DELETE" />
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/campaigns/${campaignId}/targets/${target.id}`, { method: 'DELETE' });
                            window.location.reload();
                          }}
                        >
                          Remove target
                        </button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel campaigns-list-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Activity</p>
                <h2 className="panel-title">Drafts, reminders, and audit trail</h2>
              </div>
            </div>
            {details.activity.length === 0 ? (
              <div className="crm-placeholder-card">
                <h3>No activity yet</h3>
                <p>Activity appears here as soon as drafts, reminders, or campaign updates are recorded.</p>
              </div>
            ) : (
              <div className="campaigns-list">
                {details.activity.map((item) => (
                  <article key={item.id} className="campaign-card">
                    <div className="conversation-row">
                      <div>
                        <h3>{item.label}</h3>
                        <p className="conversation-meta">{item.type}</p>
                      </div>
                      <span className="subtle-pill">{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                    {item.status ? <span className="status-chip tone-info">{item.status}</span> : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </CrmPageFrame>
  );
}