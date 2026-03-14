import { CrmPageFrame } from '@/components/crm/app-shell/crm-page-frame';

export default function AccountsPage() {
  return (
    <CrmPageFrame
      eyebrow="Accounts"
      title="Accounts"
      description="Group people into logical buying accounts, review coverage, and prepare ABM-aware outreach without forcing messy LinkedIn company names into one rigid model."
    >
      <div className="crm-placeholder-card">
        <h3>Accounts workspace is next</h3>
        <p>
          Phase 1 establishes the route and navigation. Account assignment, aliases, merge flows,
          and stakeholder coverage land in later phases.
        </p>
      </div>
    </CrmPageFrame>
  );
}