# Phase 06 Plan: Reminders

## Execution Order
1. Update TODOs first.
2. Execute the full phase scope.
3. Run the required validation.
4. Post the phase report in chat here.
5. Create the git commit for the phase.

## Objective
Add reminders.

## Scope Summary
This phase introduces reminder entities, statuses, rules, and UI affordances so operators can track follow-up work across contacts, accounts, and campaigns.

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
- Entity types:
  - contact
  - account
  - campaign
- Reminder statuses:
  - None
  - Due Today
  - Due Tomorrow
  - Overdue
  - Completed
- Rule types:
  - manual
  - after-send
  - fixed-date

## Phase Limitations
- Prefer one active reminder per entity in v1 for simplicity.

## Reuse And Compatibility Guardrails
- Integrate reminder state into existing inbox and account surfaces without rewriting them.
- Preserve current send and follow-up flows while adding reminder actions.
- Ensure reminder data is compatible with future campaign and account work.

## Files To Create
- `apps/web/lib/services/reminders-service.ts`
- `apps/web/components/crm/modals/reminder-modal.tsx`
- `apps/web/components/crm/shared/reminder-badge.tsx`
- `apps/web/app/api/reminders/route.ts`
- `apps/web/app/api/reminders/[reminderId]/route.ts`

## Files To Update
- `apps/web/lib/view-models/inbox.ts`
- `apps/web/lib/view-models/accounts.ts`
- `apps/web/lib/view-models/account-detail.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`

## Database Changes
- add `reminders`

## Implementation Checklist
- [ ] Start by updating TODOs and marking Phase 06 as in progress.
- [ ] Mark Phase 06 as in progress in the active TODO list.
- [ ] Verify reusable inbox and account surfaces.
- [ ] Add reminder schema and repository support.
- [ ] Add reminder service and APIs.
- [ ] Add reminder modal and badge UI.
- [ ] Integrate reminder state into inbox and account view-models.
- [ ] Preserve compatibility with existing follow-up behavior.
- [ ] Write phase report.
- [ ] Create focused git commit.

## Validation And Tests
Required validation:
- db typecheck
- web typecheck
- reminder API tests
- repository tests
- E2E for reminder set and due state

Suggested concrete validation set:
- `pnpm --filter @mycrm/db typecheck`
- `pnpm --filter @mycrm/web typecheck`
- targeted API and repository tests for reminder lifecycle
- Playwright flow for setting and observing reminder due states

## Result Evaluation
The phase is successful only if all of the following are true:
- Reminder state is visible and actionable.
- Reminder lifecycle works for supported entity types.
- Validation passes for DB, API, repository, and UI behavior.

## Acceptance Criteria
- Operator can create a reminder for a supported entity.
- Reminder due state is visible in the UI.
- Reminder completion and status transitions are coherent.
- One-active-reminder simplification does not break operator workflow.

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
### Phase 06 Report
- Scope completed:
- Main files changed:
- Validation run:
- Known limitations left for later phases:
- Migration or compatibility notes:
- Commit:

## Commit Format
- `phase-06: add reminders`
