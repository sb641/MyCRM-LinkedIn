import { CrmPageFrame } from '@/components/crm/app-shell/crm-page-frame';
import { IgnoredPeoplePanel } from '@/components/crm/settings/ignored-people-panel';

export default function SettingsPage() {
  return (
    <CrmPageFrame
      eyebrow="Settings"
      title="Settings"
      description="Manage workspace settings and restore ignored people from a dedicated settings surface."
    >
      <IgnoredPeoplePanel />
      <div className="crm-placeholder-card">
        <h3>More settings move here later</h3>
        <p>Workspace settings, export, and restore still live in Inbox while the dedicated settings surface is being phased in.</p>
      </div>
    </CrmPageFrame>
  );
}