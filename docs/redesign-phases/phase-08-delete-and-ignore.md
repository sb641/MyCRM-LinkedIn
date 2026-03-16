# Phase 08 Plan: Delete And Ignore Forever

## Execution Order
1. Update TODOs first.
2. Execute the full phase scope.
3. Run the required validation.
4. Post the phase report in chat here.
5. Create the git commit for the phase.

## Objective
Implement Delete and Ignore forever.

## Scope Summary
This phase adds soft-delete and sync suppression flows so ignored people stay ignored across future syncs, with restore available from Settings.

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
- User can trigger Delete and Ignore from:
  - queue row action
  - thread more menu
  - person context panel
  - draft row more menu
- Confirmation modal must include:
  - title
  - explanatory body
  - optional reason
  - cascade cleanup checkbox
  - primary CTA
- Ignored people must not be re-imported on future sync.
- Restore must exist in Settings -> Ignored People.

## Phase Limitations
- Restore should prefer reactivating soft-deleted records.
- If older data was hard-deleted before this phase, restore may be partial.

## Reuse And Compatibility Guardrails
- Use soft-delete semantics, not hard delete.
- Ensure importer and worker respect suppression state.
- Preserve restore compatibility through settings backup and restore paths.

## Files To Create
- `apps/web/lib/services/suppressions-service.ts`
- `apps/web/app/api/contacts/[contactId]/ignore/route.ts`
- `apps/web/app/api/suppressions/route.ts`
- `apps/web/app/api/suppressions/[suppressionId]/restore/route.ts`
- `apps/web/components/crm/modals/delete-ignore-modal.tsx`
- `apps/web/components/crm/settings/ignored-people-panel.tsx`

## Files To Update
- `apps/web/app/(crm)/settings/page.tsx`
- `apps/web/components/crm/inbox/inbox-row-person.tsx`
- `apps/web/components/crm/inbox/conversation-header.tsx`
- `apps/web/components/crm/inbox/context-person-tab.tsx`
- `apps/web/components/crm/drafts/draft-row.tsx`
- worker import path files
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- backup and restore logic in settings repository path

## Database Changes
- add `sync_suppressions`
- use `deletedAt` fields added earlier

## Implementation Checklist
- [x] Start by updating TODOs and marking Phase 08 as in progress.
- [x] Mark Phase 08 as in progress in the active TODO list.
- [x] Verify reusable delete, settings, and importer surfaces.
- [x] Add suppression schema and repository support.
- [ ] Add ignore and restore APIs.
- [ ] Build confirmation modal and ignored people settings panel.
- [ ] Wire ignore entry points from queue, thread, context, and draft surfaces.
- [ ] Update importer and worker paths to respect suppressions.
- [ ] Update backup and restore logic.
- [ ] Prefer soft-delete reactivation on restore.
- [ ] Write phase report.
- [ ] Create focused git commit.

## Validation And Tests
Required validation:
- db typecheck
- web typecheck
- suppression API tests
- importer suppression integration tests
- E2E for ignore and restore flow

Suggested concrete validation set:
- `pnpm --filter @mycrm/db typecheck`
- `pnpm --filter @mycrm/web typecheck`
- targeted API tests for ignore and restore
- importer integration tests proving suppressed contacts do not return
- Playwright flow for ignore and restore from Settings

## Result Evaluation
The phase is successful only if all of the following are true:
- Ignored people do not come back after sync.
- Restore works from Settings.
- Soft-delete and suppression semantics are preserved.
- Validation passes for DB, API, importer, and UI behavior.

## Acceptance Criteria
- Operator can trigger Delete and Ignore from all required entry points.
- Confirmation modal includes all required fields and actions.
- Future sync respects suppression state.
- Restore reactivates soft-deleted records where possible.

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
### Phase 08 Report
- Scope completed:
- Main files changed:
- Validation run:
- Known limitations left for later phases:
- Migration or compatibility notes:
- Commit:

## Commit Format
- `phase-08: implement delete and ignore`
