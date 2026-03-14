import { CrmPageFrame } from '@/components/crm/app-shell/crm-page-frame';

export default function CampaignsPage() {
  return (
    <CrmPageFrame
      eyebrow="Campaigns"
      title="Campaigns"
      description="Organize single-action outreach around a clear objective, target list, and reminder rhythm without turning the product into a sequence builder."
    >
      <div className="crm-placeholder-card">
        <h3>Campaigns route is ready</h3>
        <p>
          Phase 1 adds the route shell. Campaign targets, reminders, and draft grouping are added
          in later phases.
        </p>
      </div>
    </CrmPageFrame>
  );
}