import { CrmPageFrame } from '@/components/crm/app-shell/crm-page-frame';

export default function DraftsPage() {
  return (
    <CrmPageFrame
      eyebrow="Drafts"
      title="Draft Review"
      description="Review generated messages in one place, approve what is ready, and keep every send under manual control."
    >
      <div className="crm-placeholder-card">
        <h3>Draft review route is ready</h3>
        <p>
          The dedicated review queue arrives in a later phase. For now, draft generation and send
          actions remain available from Inbox.
        </p>
      </div>
    </CrmPageFrame>
  );
}