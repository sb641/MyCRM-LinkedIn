import type { ReactNode } from 'react';
import { CrmAppShell } from '@/components/crm/app-shell/crm-app-shell';

export default function CrmLayout({ children }: { children: ReactNode }) {
  return <CrmAppShell>{children}</CrmAppShell>;
}