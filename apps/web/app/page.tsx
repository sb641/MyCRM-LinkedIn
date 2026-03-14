export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getFeatureFlags } from '@mycrm/core';
import { listInboxItems, getContactConversationDetails } from '@/lib/services/inbox-service';
import { getBrowserSession } from '@/lib/services/browser-session-service';
import { listImportThreadJobs, listSyncRuns } from '@/lib/services/jobs-service';
import { listSettings } from '@/lib/services/settings-service';
import { buildShellDataState, getShellRouteState } from '@/lib/crm-shell';
import { CrmShell } from './crm-shell';

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const flags = safeGetFeatureFlags();
  const resolvedSearchParams = await searchParams;

  console.time('shell-data-load');

  const inboxResult = await safeLoad(() => listInboxItems());
  const inbox = inboxResult.data ?? [];
  const route = getShellRouteState(resolvedSearchParams, inbox);
  const detailsResult = route.selectedContactId
    ? await safeLoad(() => getContactConversationDetails(route.selectedContactId as string))
    : { data: null, error: null };
  const syncRunsResult = await safeLoad(() => listSyncRuns(undefined, 5));
  const jobsResult = await safeLoad(() => listImportThreadJobs());
  const browserSessionResult = await safeLoad(() => getBrowserSession('local-account'));
  const settingsResult = await safeLoad(() => listSettings());

  console.timeEnd('shell-data-load');

  const errorMessage = [
    inboxResult.error,
    detailsResult.error,
    syncRunsResult.error,
    jobsResult.error,
    browserSessionResult.error,
    settingsResult.error
  ].find((value) => value !== null) ?? null;

  const state = buildShellDataState({
    inbox,
    route,
    details: detailsResult.data ?? null,
    syncRuns: syncRunsResult.data ?? [],
    jobs: jobsResult.data ?? [],
    browserSession: browserSessionResult.data ?? null,
    settings: settingsResult.data ?? [],
    errorMessage
  });

  return <CrmShell state={state} flags={flags} />;
}

async function safeLoad<T>(loader: () => Promise<T>) {
  try {
    return {
      data: await loader(),
      error: null
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown workspace error'
    };
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
