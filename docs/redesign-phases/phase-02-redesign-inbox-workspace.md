# Phase 02 Plan: Redesign Inbox Workspace

## Execution Order
1. Update TODOs first.
2. Execute the full phase scope.
3. Run the required validation.
4. Post the phase report in chat here.
5. Create the git commit for the phase.

## Objective
Redesign Inbox into the main daily operating surface with queue, conversation workspace, and context panel.

## Scope Summary
This phase turns Inbox into the primary operator workspace with queue segmentation, filters, sorting, conversation handling, draft work, and contextual side panels.

## Global Constraints From Source Brief
- Single-user only.
- One LinkedIn account per workspace.
- Desktop-first UX.
- Manual approval required for every outgoing message.
- Reuse existing backend, APIs, worker, and tested flows wherever possible.
- No full rewrite.
- Preserve server-side read assembly and client-side mutation patterns.
- Keep future compatibility with Vercel plus Postgres-like deployment.
- Delete and Ignore must be soft-delete plus sync suppression plus restore.
- Campaigns are single-action outreach containers, not sequences.

## Phase-Specific Requirements
- Queue tabs:
  - Today
  - Needs Reply
  - Follow Up
  - Drafts Ready
  - Waiting
  - All People
- Queue toggle:
  - People
  - Accounts
- Queue filters scaffold:
  - Tags
  - Campaign
  - Account
  - Role
  - Outreach Status
  - Reminder
  - Has Draft
  - Unassigned Account
- Queue sorting:
  - Priority
  - Most Recent
  - Name
  - Company
- Center panel must include:
  - conversation header
  - message timeline
  - draft composer
  - draft variants
- Right context panel tabs:
  - Person
  - Account
  - Campaign

## Phase Limitations
- Account and Campaign context tabs may be partial until later phases add full entities.
- Queue toggle can initially degrade gracefully when account data is missing.

## Reuse And Compatibility Guardrails
- Preserve existing draft generation and send flows.
- Keep inbox read assembly and mutation patterns compatible with current services.
- Update backup and restore compatibility for any new fields added in this phase.
- Verify whether worker or importer behavior is affected by new soft-delete and account-related fields.

## Files To Create
- `apps/web/lib/view-models/inbox.ts`
- `apps/web/components/crm/inbox/inbox-page.tsx`
- `apps/web/components/crm/inbox/inbox-toolbar.tsx`
- `apps/web/components/crm/inbox/inbox-tabs.tsx`
- `apps/web/components/crm/inbox/inbox-filters.tsx`
- `apps/web/components/crm/inbox/inbox-queue.tsx`
- `apps/web/components/crm/inbox/inbox-row-person.tsx`
- `apps/web/components/crm/inbox/inbox-row-account.tsx`
- `apps/web/components/crm/inbox/conversation-workspace.tsx`
- `apps/web/components/crm/inbox/conversation-header.tsx`
- `apps/web/components/crm/inbox/message-timeline.tsx`
- `apps/web/components/crm/inbox/draft-composer.tsx`
- `apps/web/components/crm/inbox/draft-variants.tsx`
- `apps/web/components/crm/inbox/context-panel.tsx`
- `apps/web/components/crm/inbox/context-person-tab.tsx`
- `apps/web/components/crm/inbox/context-account-tab.tsx`
- `apps/web/components/crm/inbox/context-campaign-tab.tsx`

## Files To Update
- `apps/web/app/(crm)/inbox/page.tsx`
- `apps/web/lib/services/inbox-service.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/app/api/inbox/route.ts` if filter/query support is added

## Database Changes
Update `contacts`:
- `accountId` nullable
- `outreachStatus` nullable
- `nextReminderAt` nullable
- `deletedAt` nullable
- `seniorityBucket` nullable
- `buyingRole` nullable

Update `conversations`:
- `deletedAt` nullable

Update `drafts`:
- `deletedAt` nullable

## Implementation Checklist
- [ ] Start by updating TODOs and marking Phase 02 as in progress.
- [ ] Mark Phase 02 as in progress in the active TODO list.
- [ ] Verify reusable inbox services, APIs, and tests.
- [ ] Add inbox view-model for queue, filters, sorting, and selection.
- [ ] Build queue tabs, filters, and people/accounts toggle.
- [ ] Build conversation workspace and context panel.
- [ ] Add DB fields required for inbox redesign.
- [ ] Update repositories and services for new fields.
- [ ] Update backup and restore compatibility for new fields.
- [ ] Update inbox API if query/filter support is needed.
- [ ] Preserve existing draft and send flows.
- [ ] Write phase report.
- [ ] Create focused git commit.

## Validation And Tests
Required validation:
- db typecheck
- web typecheck
- inbox view-model tests
- inbox service tests
- updated inbox E2E smoke

Suggested concrete validation set:
- `pnpm --filter @mycrm/db typecheck`
- `pnpm --filter @mycrm/web typecheck`
- targeted tests for inbox view-model and inbox service
- updated Playwright smoke for inbox queue and conversation workflow

## Result Evaluation
The phase is successful only if all of the following are true:
- Inbox becomes the main operating surface.
- Existing draft and send flows still work.
- New fields are added without breaking backup and restore.
- Queue, workspace, and context panel are coherent and usable.
- Validation passes for DB, web, and inbox-specific behavior.

## Acceptance Criteria
- Operator can work from queue to thread to draft without leaving Inbox.
- Queue tabs, filters, and sorting are visible and functional at the intended scaffold level.
- Context panel exposes Person, Account, and Campaign tabs.
- Missing account data does not break the page.
- Soft-delete-ready fields exist for later phases.

## Reporting Requirements
After validation, write a concise report with:
- what changed
- what was validated
- known limitations intentionally left for later phases
- migration or compatibility notes

End-of-phase requirement:
- Post the phase report in chat here before closing the phase.
- Create the focused git commit after successful validation and reporting.

## Phase Report Template
### Phase 02 Report
- Scope completed:
- Main files changed:
- Validation run:
- Known limitations left for later phases:
- Migration or compatibility notes:
- Commit:

## Commit Format
- `phase-02: redesign inbox workspace`
