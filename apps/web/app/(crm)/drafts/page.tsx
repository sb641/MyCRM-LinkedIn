export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getFeatureFlags } from '@mycrm/core';
import { CrmPageFrame } from '@/components/crm/app-shell/crm-page-frame';
import { DraftActions } from '@/components/crm/drafts/draft-actions';
import { getBrowserSession } from '@/lib/services/browser-session-service';
import { getContactConversationDetails, listInboxItems } from '@/lib/services/inbox-service';
import { buildShellDataState, getShellRouteState } from '@/lib/crm-shell';
import { buildDraftReviewViewModel } from '@/lib/view-models/drafts';

type DraftsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DraftsPage({ searchParams }: DraftsPageProps) {
  const resolvedSearchParams = await searchParams;
  const inbox = await listInboxItems();
  const route = getShellRouteState(resolvedSearchParams, inbox);
  const details = route.selectedContactId ? await getContactConversationDetails(route.selectedContactId) : null;
  const browserSession = await getBrowserSession('local-account').catch(() => null);
  const state = buildShellDataState({
    inbox,
    route,
    details,
    browserSession,
    settings: []
  });
  const workspace = buildDraftReviewViewModel(state, {
    tab: getSingleValue(resolvedSearchParams.tab),
    groupBy: getSingleValue(resolvedSearchParams.groupBy),
    account: getSingleValue(resolvedSearchParams.account),
    role: getSingleValue(resolvedSearchParams.role),
    generatedToday: getSingleValue(resolvedSearchParams.generatedToday)
  });
  const flags = safeGetFeatureFlags();

  return (
    <CrmPageFrame
      eyebrow="Drafts"
      title="Draft Review"
      description="Review generated messages outside Inbox, approve what is ready, and queue sends without forking the existing backend flow."
      actions={<span className="subtle-pill">Manual approval only</span>}
    >
      <div className="drafts-review-shell">
        <section className="panel drafts-toolbar-panel">
          <div className="inbox-queue-tabs" aria-label="Draft review tabs">
            {workspace.tabs.map((tab) => (
              <Link
                key={tab.key}
                href={{ pathname: '/drafts', query: buildQuery(resolvedSearchParams, { tab: tab.key }) }}
                className={tab.isActive ? 'queue-tab active' : 'queue-tab'}
              >
                <span>{tab.label}</span>
                <span className="count-pill">{tab.count}</span>
              </Link>
            ))}
          </div>
          <div className="chip-row" aria-label="Draft review filters">
            <span className="subtle-pill">Account filters: {workspace.filters.accounts.length || 'partial'}</span>
            <span className="subtle-pill">Role filters: {workspace.filters.roles.length || 'partial'}</span>
            <span className="subtle-pill">Campaign filters: later phase</span>
            <span className="subtle-pill">AI: {String(flags.ENABLE_AI)}</span>
          </div>
        </section>

        {workspace.items.length === 0 ? (
          <div className="crm-placeholder-card">
            <h3>No drafts in this review state</h3>
            <p>Switch tabs or generate more drafts from Inbox to populate the review queue.</p>
          </div>
        ) : (
          <div className="draft-review-groups">
            {workspace.groups.map((group) => (
              <section key={group.key} className="panel draft-review-group">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Grouped by {workspace.activeGrouping}</p>
                    <h2 className="panel-title">{group.label}</h2>
                  </div>
                  <span className="subtle-pill">{group.items.length} drafts</span>
                </div>
                <div className="draft-review-list">
                  {group.items.map((item) => (
                    <article key={item.draftId} className="draft-review-row">
                      <div className="conversation-row">
                        <div>
                          <h3>{item.contactName}</h3>
                          <p className="conversation-meta">{item.company ?? 'Independent'} · {item.role ?? 'Unknown role'}</p>
                        </div>
                        <div className="chip-row">
                          <span className="status-chip tone-info">{item.statusLabel}</span>
                          <span className="subtle-pill">{item.createdAtLabel}</span>
                        </div>
                      </div>
                      <p className="conversation-preview">{item.approvedText ?? item.goalText}</p>
                      <div className="chip-row">
                        <span className="subtle-pill">Account: {item.accountId ?? 'Unknown'}</span>
                        <span className="subtle-pill">Role: {item.role ?? 'Unknown'}</span>
                        <span className="subtle-pill">Relationship: {item.relationshipStatus}</span>
                      </div>
                      <div className="quick-action-row">
                        <Link className="ghost-button" href={item.openThreadHref}>
                          Open Thread
                        </Link>
                      </div>
                      <DraftActions
                        draftId={item.draftId}
                        draftStatus={item.draftStatus}
                        approvedText={item.approvedText}
                        goalText={item.goalText}
                        conversationId={item.conversationId}
                        accountId={item.accountId ?? browserSession?.accountId ?? 'local-account'}
                      />
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </CrmPageFrame>
  );
}

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function buildQuery(
  searchParams: Record<string, string | string[] | undefined>,
  updates: Record<string, string | null | undefined>
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    const singleValue = getSingleValue(value);
    if (singleValue) {
      params.set(key, singleValue);
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      params.delete(key);
      continue;
    }

    params.set(key, value);
  }

  return Object.fromEntries(params.entries());
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