type CrmTopbarProps = {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: React.ReactNode;
};

export function CrmTopbar({ title, description, eyebrow = 'Workspace', actions }: CrmTopbarProps) {
  return (
    <header className="crm-route-topbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="crm-route-title">{title}</h2>
        <p className="crm-route-copy">{description}</p>
      </div>
      {actions ? <div className="crm-route-actions">{actions}</div> : null}
    </header>
  );
}