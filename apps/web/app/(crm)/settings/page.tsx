import { CrmPageFrame } from '@/components/crm/app-shell/crm-page-frame';

export default function SettingsPage() {
  return (
    <CrmPageFrame
      eyebrow="Settings"
      title="Settings"
      description="Manage workspace settings, AI configuration, export, restore, and later the ignored people list from a dedicated settings surface."
    >
      <div className="crm-placeholder-card">
        <h3>Settings route is ready</h3>
        <p>
          Existing settings, export, and restore actions remain available from Inbox in Phase 1.
          They move into this page in later phases.
        </p>
      </div>
    </CrmPageFrame>
  );
}