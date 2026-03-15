# Phase 03 Plan: Drafts Review Page

## Execution Order
1. Update TODOs first.
2. Execute the full phase scope.
3. Run the required validation.
4. Post the phase report in chat here.
5. Create the git commit for the phase.

## Objective
Add a dedicated Drafts review page.

## Scope Summary
This phase separates draft review from Inbox and creates a dedicated operator surface for reviewing, approving, sending, grouping, and filtering drafts.

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
- Tabs:
  - Needs Review
  - Approved
  - Sent
  - Failed
- Filters:
  - Campaign
  - Account
  - Tag
  - Role
  - Generated Today
- Actions:
  - Open Thread
  - Edit
  - Approve
  - Send
  - Delete Draft
- Grouping:
  - Account
  - Campaign
  - Status

## Phase Limitations
- Campaign and Account filters may be partial until those entities are implemented.
- Edit can initially mean editing approved text rather than a full rich editor.

## Reuse And Compatibility Guardrails
- Approval and send must reuse the existing backend flow.
- Draft review must not fork or duplicate send logic.
- Preserve compatibility with current draft persistence and queueing behavior.

## Files To Create
- `apps/web/lib/view-models/drafts.ts`
- `apps/web/app/(crm)/drafts/page.tsx`
- `apps/web/components/crm/drafts/drafts-page.tsx`
- `apps/web/components/crm/drafts/drafts-toolbar.tsx`
- `apps/web/components/crm/drafts/drafts-filters.tsx`
- `apps/web/components/crm/drafts/draft-list.tsx`
- `apps/web/components/crm/drafts/draft-row.tsx`
- `apps/web/components/crm/drafts/draft-group.tsx`
- `apps/web/app/api/drafts/route.ts` if needed

## Files To Update
- `apps/web/lib/services/crm-service.ts`
- `packages/db/src/repositories.ts`

## Implementation Checklist
- [ ] Start by updating TODOs and marking Phase 03 as in progress.
- [ ] Mark Phase 03 as in progress in the active TODO list.
- [ ] Verify reusable draft services, APIs, and tests.
- [ ] Add drafts view-model for tabs, filters, grouping, and actions.
- [ ] Build dedicated Drafts page and list UI.
- [ ] Reuse existing approve and send flows.
- [ ] Add or extend draft API only if needed.
- [ ] Update repository reads for grouping and filtering if required.
- [ ] Write phase report.
- [ ] Create focused git commit.

## Validation And Tests
Required validation:
- web typecheck
- draft page tests
- draft API tests if added
- E2E for review and send flow

Suggested concrete validation set:
- `pnpm --filter @mycrm/web typecheck`
- targeted component and page tests for Drafts review
- API tests if a new drafts route is introduced
- Playwright flow for review, approve, and send

## Result Evaluation
The phase is successful only if all of the following are true:
- Draft review can be done outside Inbox.
- Approval and send reuse the existing backend flow.
- Draft filtering and grouping are usable at the intended phase scope.
- Validation passes for the changed surface.

## Acceptance Criteria
- Operator can review drafts without opening Inbox.
- Approve and send actions behave consistently with existing workflow.
- Open Thread returns the operator to the relevant conversation context.
- Partial campaign/account filters do not break the page.

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
### Phase 03 Report
- Scope completed:
- Main files changed:
- Validation run:
- Known limitations left for later phases:
- Migration or compatibility notes:
- Commit:

## Commit Format
- `phase-03: add drafts review page`
