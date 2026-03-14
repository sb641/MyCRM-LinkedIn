'use client';

import { usePathname } from 'next/navigation';
import { CrmNav } from './crm-nav';

type CrmAppShellProps = {
  children: React.ReactNode;
};

export function CrmAppShell({ children }: CrmAppShellProps) {
  const pathname = usePathname();

  return (
    <main className="crm-app-shell">
      <div className="crm-backdrop" />
      <div className="crm-app-layout">
        <CrmNav currentPath={pathname} />
        <div className="crm-app-content">{children}</div>
      </div>
    </main>
  );
}