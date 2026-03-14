type CrmPageFrameProps = {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

import { CrmTopbar } from './crm-topbar';

export function CrmPageFrame({ title, description, eyebrow, actions, children }: CrmPageFrameProps) {
  return (
    <section className="crm-route-frame">
      <CrmTopbar title={title} description={description} eyebrow={eyebrow} actions={actions} />
      <div className="crm-route-body">{children}</div>
    </section>
  );
}