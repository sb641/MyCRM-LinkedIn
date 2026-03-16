'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CrmNav } from './crm-nav';

type CrmAppShellProps = {
  children: React.ReactNode;
};

export function CrmAppShell({ children }: CrmAppShellProps) {
  const pathname = usePathname();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  useEffect(() => {
    const storedValue = window.localStorage.getItem('mycrm.nav.collapsed');
    if (storedValue === 'true') {
      setIsNavCollapsed(true);
    }
  }, []);

  function handleToggleNav() {
    setIsNavCollapsed((current) => {
      const nextValue = !current;
      window.localStorage.setItem('mycrm.nav.collapsed', String(nextValue));
      return nextValue;
    });
  }

  return (
    <main className="crm-app-shell">
      <div className="crm-backdrop" />
      <div className={isNavCollapsed ? 'crm-app-layout is-nav-collapsed' : 'crm-app-layout'}>
        <CrmNav currentPath={pathname} isCollapsed={isNavCollapsed} onToggleCollapse={handleToggleNav} />
        <div className="crm-app-content">{children}</div>
      </div>
    </main>
  );
}