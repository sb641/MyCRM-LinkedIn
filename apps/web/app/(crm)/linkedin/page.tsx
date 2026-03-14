import { CrmPageFrame } from '@/components/crm/app-shell/crm-page-frame';

export default function LinkedInPage() {
  return (
    <CrmPageFrame
      eyebrow="LinkedIn"
      title="LinkedIn Connection"
      description="Manage connection readiness, sync status, and sync history from a dedicated operational page instead of burying it inside the inbox sidebar."
    >
      <div className="crm-placeholder-card">
        <h3>LinkedIn operations route is ready</h3>
        <p>
          Phase 1 moves the information architecture into place. Dedicated connection and sync
          management UI follows in later phases.
        </p>
      </div>
    </CrmPageFrame>
  );
}