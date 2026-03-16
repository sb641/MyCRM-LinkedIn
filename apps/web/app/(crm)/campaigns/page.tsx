export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { CrmPageFrame } from '@/components/crm/app-shell/crm-page-frame';
import { CampaignActions } from '@/components/crm/campaigns/campaign-actions';
import { listCampaigns } from '@/lib/services/campaigns-service';
import { listInboxItems } from '@/lib/services/inbox-service';

export default async function CampaignsPage() {
  const [campaigns, inbox] = await Promise.all([listCampaigns(), listInboxItems()]);

  return (
    <CrmPageFrame
      eyebrow="Campaigns"
      title="Campaigns"
      description="Organize single-action outreach around a clear objective, target list, and reminder rhythm without turning the product into a sequence builder."
    >
      <div className="campaigns-page-grid">
        <CampaignActions availableTargets={inbox} />
        <section className="panel campaigns-list-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Active workspace</p>
              <h2 className="panel-title">Campaign list</h2>
            </div>
            <span className="subtle-pill">{campaigns.length} total</span>
          </div>
          {campaigns.length === 0 ? (
            <div className="crm-placeholder-card">
              <h3>No campaigns yet</h3>
              <p>Create the first campaign to group targets, reminders, and draft activity around one objective.</p>
            </div>
          ) : (
            <div className="campaigns-list">
              {campaigns.map((campaign) => (
                <article key={campaign.id} className="campaign-card">
                  <div className="conversation-row">
                    <div>
                      <h3>{campaign.name}</h3>
                      <p className="conversation-meta">{campaign.objective}</p>
                    </div>
                    <span className="status-chip tone-info">{campaign.status}</span>
                  </div>
                  <div className="chip-row">
                    <span className="subtle-pill">Targets: {campaign.targetCount}</span>
                    <span className="subtle-pill">Drafts: {campaign.draftCount}</span>
                    <span className="subtle-pill">Reminders: {campaign.reminderCount}</span>
                  </div>
                  <div className="chip-row">
                    {campaign.tags.length === 0 ? <span className="subtle-pill">No tags</span> : campaign.tags.map((tag) => <span key={tag} className="subtle-pill">#{tag}</span>)}
                  </div>
                  <div className="quick-action-row">
                    <Link className="ghost-button" href={{ pathname: '/campaigns/[campaignId]', query: { campaignId: campaign.id } }}>
                      Open campaign
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </CrmPageFrame>
  );
}