'use client';

import { useRouter } from 'next/navigation';

type CrmNavProps = {
  currentPath: string;
};

const NAV_ITEMS = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/drafts', label: 'Drafts' },
  { href: '/linkedin', label: 'LinkedIn' },
  { href: '/settings', label: 'Settings' }
] as const;

export function CrmNav({ currentPath }: CrmNavProps) {
  const router = useRouter();

  return (
    <nav className="crm-nav" aria-label="Primary">
      <div className="crm-nav-brand">
        <p className="eyebrow">MyCRM</p>
        <h1>Outreach Workspace</h1>
      </div>
      <div className="crm-nav-links">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);

          return (
            <button
              type="button"
              key={item.href}
              className={isActive ? 'crm-nav-link active' : 'crm-nav-link'}
              onClick={() => router.push(item.href)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}