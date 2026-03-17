'use client';

import { useRouter } from 'next/navigation';

type CrmNavProps = {
  currentPath: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
};

const NAV_ITEMS = [
  { href: '/inbox', label: 'Inbox', shortLabel: 'IN' },
  { href: '/accounts', label: 'Accounts', shortLabel: 'AC' },
  { href: '/campaigns', label: 'Campaigns', shortLabel: 'CA' },
  { href: '/drafts', label: 'Drafts', shortLabel: 'DR' },
  { href: '/linkedin', label: 'LinkedIn', shortLabel: 'LI' },
  { href: '/settings', label: 'Settings', shortLabel: 'SE' }
] as const;

export function CrmNav({ currentPath, isCollapsed, onToggleCollapse }: CrmNavProps) {
  const router = useRouter();
  const primaryItems = NAV_ITEMS.slice(0, 4);
  const secondaryItems = NAV_ITEMS.slice(4);

  return (
    <nav className={isCollapsed ? 'crm-nav is-collapsed' : 'crm-nav'} aria-label="Primary">
      <div className="crm-nav-brand">
        <div className="crm-nav-brand-mark" aria-hidden="true">
          MC
        </div>
        {!isCollapsed ? (
          <div className="crm-nav-brand-copy">
            <p className="eyebrow">MyCRM</p>
            <h1>Operator Console</h1>
            <p className="crm-nav-brand-meta">LinkedIn workspace</p>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="crm-nav-collapse-toggle"
        onClick={onToggleCollapse}
        aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        aria-pressed={isCollapsed}
      >
        {isCollapsed ? '>' : '<'}
      </button>
      <div className="crm-nav-section-label">Queue</div>
      <div className="crm-nav-links">
        {primaryItems.map((item) => renderNavItem(item, currentPath, isCollapsed, () => router.push(item.href)))}
      </div>
      <div className="crm-nav-spacer" />
      <div className="crm-nav-section-label">Workspace</div>
      <div className="crm-nav-links">
        {secondaryItems.map((item) => renderNavItem(item, currentPath, isCollapsed, () => router.push(item.href)))}
      </div>
    </nav>
  );
}

function renderNavItem(
  item: (typeof NAV_ITEMS)[number],
  currentPath: string,
  isCollapsed: boolean,
  onNavigate: () => void
) {
  const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);

  return (
    <button
      type="button"
      key={item.href}
      className={isActive ? 'crm-nav-link active' : 'crm-nav-link'}
      onClick={onNavigate}
      aria-label={item.label}
      title={item.label}
    >
      <span className="crm-nav-link-icon" aria-hidden="true">
        {item.shortLabel}
      </span>
      {!isCollapsed ? <span className="crm-nav-link-label">{item.label}</span> : null}
    </button>
  );
}