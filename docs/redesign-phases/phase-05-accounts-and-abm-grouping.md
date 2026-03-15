# Phase 05 Plan: Accounts And Manual ABM Grouping

## Execution Order
1. Update TODOs first.
2. Execute the full phase scope.
3. Run the required validation.
4. Post the phase report in chat here.
5. Create the git commit for the phase.

## Objective
Add Accounts and manual ABM grouping.

## Scope Summary
This phase introduces logical accounts, manual assignment and merge flows, alias preservation, and stakeholder mapping for account-centric outreach work.

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
- Users can assign people into logical accounts.
- Users can create accounts manually.
- Users can merge accounts manually.
- Source names must be preserved as aliases.
- Stakeholder map must be lane-based:
  - Executive
  - Director
  - Manager / Other
  - Unclassified

## Phase Limitations
- No auto-merge without user confirmation.
- Coverage signals can be rule-based in v1.

## Reuse And Compatibility Guardrails
- Preserve contact-level workflows while adding account grouping.
- Keep merge behavior safe and explicit.
- Ensure aliases preserve source naming history.
- Verify backup and restore compatibility for new account entities.

## Files To Create
- `apps/web/lib/view-models/accounts.ts`
- `apps/web/lib/view-models/account-detail.ts`
- `apps/web/lib/services/accounts-service.ts`
- `apps/web/app/(crm)/accounts/page.tsx`
- `apps/web/app/(crm)/accounts/[accountId]/page.tsx`
- `apps/web/components/crm/accounts/accounts-page.tsx`
- `apps/web/components/crm/accounts/account-list.tsx`
- `apps/web/components/crm/accounts/account-row.tsx`
- `apps/web/components/crm/accounts/account-detail-page.tsx`
- `apps/web/components/crm/accounts/account-overview.tsx`
- `apps/web/components/crm/accounts/account-people-tab.tsx`
- `apps/web/components/crm/accounts/account-activity-tab.tsx`
- `apps/web/components/crm/accounts/account-campaigns-tab.tsx`
- `apps/web/components/crm/accounts/account-drafts-tab.tsx`
- `apps/web/components/crm/accounts/account-aliases-tab.tsx`
- `apps/web/components/crm/accounts/stakeholder-lanes.tsx`
- `apps/web/components/crm/modals/assign-account-modal.tsx`
- `apps/web/components/crm/modals/create-account-modal.tsx`
- `apps/web/components/crm/modals/merge-accounts-modal.tsx`
- `apps/web/app/api/accounts/route.ts`
- `apps/web/app/api/accounts/merge/route.ts`
- `apps/web/app/api/accounts/[accountId]/route.ts`
- `apps/web/app/api/accounts/[accountId]/assign-contacts/route.ts`
- `apps/web/app/api/accounts/[accountId]/aliases/route.ts`
- `apps/web/app/api/accounts/[accountId]/aliases/[aliasId]/route.ts`

## Files To Update
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`

## Database Changes
- add `accounts`
- add `account_aliases`

## Implementation Checklist
- [ ] Start by updating TODOs and marking Phase 05 as in progress.
- [ ] Mark Phase 05 as in progress in the active TODO list.
- [ ] Verify reusable contact, draft, and activity reads.
- [ ] Add account schema and repository support.
- [ ] Build accounts list and account detail surfaces.
- [ ] Add assign, create, and merge account flows.
- [ ] Preserve source names as aliases.
- [ ] Add stakeholder lane presentation.
- [ ] Add account APIs.
- [ ] Update backup and restore compatibility.
- [ ] Write phase report.
- [ ] Create focused git commit.

## Validation And Tests
Required validation:
- db typecheck
- web typecheck
- account API tests
- repository integration tests for merge and aliases
- E2E for assign and merge flow

Suggested concrete validation set:
- `pnpm --filter @mycrm/db typecheck`
- `pnpm --filter @mycrm/web typecheck`
- targeted API tests for account CRUD, assignment, merge, and aliases
- repository integration tests for merge safety and alias preservation
- Playwright flow for assign and merge

## Result Evaluation
The phase is successful only if all of the following are true:
- Contacts can be assigned to logical accounts.
- Accounts can be merged safely.
- Aliases are preserved.
- Validation passes for DB, API, repository, and UI behavior.

## Acceptance Criteria
- Operator can create an account manually.
- Operator can assign contacts to an account.
- Operator can merge accounts only through explicit confirmation.
- Stakeholder map is visible in lane-based form.
- Alias history survives merge operations.

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
### Phase 05 Report
- Scope completed:
- Main files changed:
- Validation run:
- Known limitations left for later phases:
- Migration or compatibility notes:
- Commit:

## Commit Format
- `phase-05: add accounts and abm grouping`
