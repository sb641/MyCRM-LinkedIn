import { getFeatureFlags } from '@mycrm/core';
import { listInboxItems, getContactConversationDetails } from '@/lib/services/inbox-service';
import { listImportThreadJobs, listSyncRuns } from '@/lib/services/jobs-service';
import { buildShellDataState, getShellRouteState } from '@/lib/crm-shell';
import { CrmShell } from './crm-shell';

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const flags = safeGetFeatureFlags();
  const resolvedSearchParams = await searchParams;

  try {
    const inbox = await listInboxItems();
    const route = getShellRouteState(resolvedSearchParams, inbox);
    const details = route.selectedContactId
      ? await getContactConversationDetails(route.selectedContactId)
      : null;
    const syncRuns = await listSyncRuns(undefined, 5);
    const jobs = await listImportThreadJobs();

    const state = buildShellDataState({
      inbox,
      route,
      details,
      syncRuns,
      jobs
    });

    return <CrmShell state={state} flags={flags} />;
  } catch (error) {
    const state = buildShellDataState({
      inbox: [],
      route: { selectedContactId: null, selectedConversationId: null, sort: 'recent' },
      details: null,
      syncRuns: [],
      jobs: [],
      errorMessage: error instanceof Error ? error.message : 'Unknown workspace error'
    });

    return <CrmShell state={state} flags={flags} />;
  }
}

function safeGetFeatureFlags() {
  try {
    return getFeatureFlags();
  } catch {
    return {
      ENABLE_AI: false,
      ENABLE_AUTOMATION: false,
      ENABLE_REAL_BROWSER_SYNC: false,
      ENABLE_REAL_SEND: false
    };
  }
}
