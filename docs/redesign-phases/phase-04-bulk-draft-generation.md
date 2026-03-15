# Phase 04 Plan: Bulk Draft Generation

## Execution Order
1. Update TODOs first.
2. Execute the full phase scope.
3. Run the required validation.
4. Post the phase report in chat here.
5. Create the git commit for the phase.

## Objective
Add bulk draft generation from selected people.

## Scope Summary
This phase adds multi-select draft generation with operator-provided goals and ABM-aware options while preserving manual approval for every send.

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
- Entry points:
  - Inbox
  - later Accounts page
  - later Campaign detail page
- Bulk draft modal fields:
  - What should these messages achieve?
  - Link to include
  - Call to action
  - Tone
  - Constraints
- ABM-aware options:
  - Use recent conversation context
  - Use account context
  - Vary the message by role
  - Avoid repeating the same angle within the same account
- Every generated draft remains editable.
- Every send still requires manual approval.

## Phase Limitations
- Initial implementation may orchestrate repeated single-contact generation under the hood.
- No auto-approval or auto-send.

## Reuse And Compatibility Guardrails
- Reuse existing single-contact generation flow where practical.
- Do not bypass manual approval.
- Keep generated drafts editable and reviewable through existing draft workflow.

## Files To Create
- `apps/web/components/crm/modals/bulk-draft-modal.tsx`
- `apps/web/app/api/drafts/bulk-generate/route.ts`

## Files To Update
- `apps/web/components/crm/inbox/inbox-queue.tsx`
- `apps/web/components/crm/inbox/inbox-toolbar.tsx`
- `apps/web/components/crm/inbox/inbox-row-person.tsx`
- `apps/web/lib/services/crm-service.ts`
- `packages/db/src/repositories.ts`

## Implementation Checklist
- [ ] Start by updating TODOs and marking Phase 04 as in progress.
- [ ] Mark Phase 04 as in progress in the active TODO list.
- [ ] Verify reusable draft generation services and tests.
- [ ] Add multi-select entry points in Inbox.
- [ ] Build bulk draft modal with required fields and options.
- [ ] Add bulk generation API route.
- [ ] Reuse existing generation flow under the hood where practical.
- [ ] Ensure generated drafts remain editable.
- [ ] Ensure send still requires manual approval.
- [ ] Write phase report.
- [ ] Create focused git commit.

## Validation And Tests
Required validation:
- web typecheck
- bulk generate API tests
- component tests for selection and modal flow
- E2E for multi-select and bulk generation

Suggested concrete validation set:
- `pnpm --filter @mycrm/web typecheck`
- targeted API tests for bulk generation route
- component tests for selection state and modal submission
- Playwright flow for multi-select and generated draft results

## Result Evaluation
The phase is successful only if all of the following are true:
- User can select multiple people and generate drafts in one action.
- Generated drafts remain editable.
- No send path bypasses manual approval.
- Validation passes for the changed surface.

## Acceptance Criteria
- Operator can select multiple people from Inbox.
- Bulk modal captures the required generation inputs.
- Generated drafts appear in the existing review workflow.
- Repeated single-contact orchestration, if used, is invisible to the operator.

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
### Phase 04 Report
- Scope completed:
- Main files changed:
- Validation run:
- Known limitations left for later phases:
- Migration or compatibility notes:
- Commit:

## Commit Format
- `phase-04: add bulk draft generation`
