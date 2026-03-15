# Phase 09 Plan: Tags And Lightweight Productivity Polish

## Execution Order
1. Update TODOs first.
2. Execute the full phase scope.
3. Run the required validation.
4. Post the phase report in chat here.
5. Create the git commit for the phase.

## Objective
Add tags and lightweight productivity polish.

## Scope Summary
This phase introduces tags across core CRM entities and extends filtering and lightweight workflow polish in the main operator surfaces.

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
- Tags must work across contacts, accounts, and campaigns at minimum.
- Inbox and Drafts filters must support tags.

## Phase Limitations
- Keep tag color system simple in v1.

## Reuse And Compatibility Guardrails
- Extend existing view-models rather than replacing them.
- Keep tag model simple and compatible with future entity expansion.
- Preserve current filtering behavior while adding tag support.

## Files To Create
- `apps/web/lib/services/tags-service.ts`
- `apps/web/components/crm/shared/tag-chip.tsx`
- `apps/web/components/crm/modals/tag-assignment-modal.tsx`
- `apps/web/app/api/tags/route.ts`
- `apps/web/app/api/tags/assign/route.ts`

## Files To Update
- inbox, drafts, accounts, campaigns view-models
- relevant list rows and filters
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`

## Database Changes
- add `tags`
- add `entity_tags`

## Implementation Checklist
- [ ] Start by updating TODOs and marking Phase 09 as in progress.
- [ ] Mark Phase 09 as in progress in the active TODO list.
- [ ] Verify reusable filters and list row surfaces.
- [ ] Add tag schema and repository support.
- [ ] Add tag service and APIs.
- [ ] Build tag chip and assignment modal.
- [ ] Extend inbox, drafts, accounts, and campaigns view-models for tags.
- [ ] Add tag filtering support to Inbox and Drafts.
- [ ] Write phase report.
- [ ] Create focused git commit.

## Validation And Tests
Required validation:
- db typecheck
- web typecheck
- tag API tests
- filter tests

Suggested concrete validation set:
- `pnpm --filter @mycrm/db typecheck`
- `pnpm --filter @mycrm/web typecheck`
- targeted API tests for tag creation and assignment
- filter tests for Inbox and Drafts tag behavior

## Result Evaluation
The phase is successful only if all of the following are true:
- Tags can be assigned and filtered.
- Tag support works across the minimum required entities.
- Validation passes for DB, API, and filter behavior.

## Acceptance Criteria
- Operator can assign tags to supported entities.
- Inbox filters support tags.
- Drafts filters support tags.
- Simple v1 tag color treatment does not reduce usability.

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
### Phase 09 Report
- Scope completed:
- Main files changed:
- Validation run:
- Known limitations left for later phases:
- Migration or compatibility notes:
- Commit:

## Commit Format
- `phase-09: add tags and productivity polish`
