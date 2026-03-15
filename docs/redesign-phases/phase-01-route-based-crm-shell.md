# Phase 01 Plan: Route-Based CRM Shell

## Execution Order
1. Update TODOs first.
2. Execute the full phase scope.
3. Run the required validation.
4. Post the phase report in chat here.
5. Create the git commit for the phase.

## Objective
Create the new route-based CRM shell and move the current single-page workspace into the new navigation structure.

## Scope Summary
This phase establishes the product shell, route structure, and first-pass product copy while preserving all currently working operator flows.

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
- `/` must redirect to `/inbox`.
- Main navigation must exist:
  - Inbox
  - Accounts
  - Campaigns
  - Drafts
  - LinkedIn
  - Settings
- The shell must feel like a product workspace, not a temporary dev shell.
- Existing working flows must remain usable from the new shell:
  - inbox loading
  - conversation selection
  - draft generation
  - draft send queueing
  - manual sync queueing
  - settings save
  - export workspace data
  - restore workspace data
- Product-facing copy replacements must start in this phase.

## Phase Limitations
- No new DB entities in this phase.
- Accounts, Campaigns, Drafts, LinkedIn, and Settings pages may start as structured placeholders if their full feature work belongs to later phases.
- The old `crm-shell.tsx` may remain temporarily as an internal implementation detail, but the route structure must be real.

## Reuse And Compatibility Guardrails
- Reuse current server-side data assembly from `apps/web/app/page.tsx`.
- Reuse current services in `apps/web/lib/services`.
- Reuse current APIs unchanged where possible.
- Reuse current shell state and view-model logic until later phases split it further.
- Keep all existing working flows backward-compatible from the operator perspective.

## Files To Create
- `apps/web/app/(crm)/layout.tsx`
- `apps/web/app/(crm)/inbox/page.tsx`
- `apps/web/app/(crm)/accounts/page.tsx`
- `apps/web/app/(crm)/campaigns/page.tsx`
- `apps/web/app/(crm)/drafts/page.tsx`
- `apps/web/app/(crm)/linkedin/page.tsx`
- `apps/web/app/(crm)/settings/page.tsx`
- `apps/web/components/crm/app-shell/crm-app-shell.tsx`
- `apps/web/components/crm/app-shell/crm-nav.tsx`
- `apps/web/components/crm/app-shell/crm-topbar.tsx`
- `apps/web/components/crm/app-shell/crm-page-frame.tsx`

## Files To Update
- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/app/page.test.tsx`
- `apps/web/e2e/crm-shell.spec.ts`
- `apps/web/app/crm-shell.tsx` only if needed to extract or wrap legacy content

## Implementation Checklist
- [ ] Start by updating TODOs and marking Phase 01 as in progress.
- [ ] Mark Phase 01 as in progress in the active TODO list.
- [ ] Confirm which current shell files can be reused without breaking behavior.
- [ ] Add route group layout for CRM pages.
- [ ] Redirect `/` to `/inbox`.
- [ ] Add main navigation and top bar.
- [ ] Move current inbox-capable workspace into the new shell.
- [ ] Add structured placeholder pages for non-inbox routes where needed.
- [ ] Improve product-facing copy on migrated surfaces.
- [ ] Update tests for route-based shell behavior.
- [ ] Write phase report.
- [ ] Create focused git commit.

## Validation And Tests
Required validation:
- web typecheck
- relevant web tests
- E2E smoke flow updated for `/inbox`

Suggested concrete validation set:
- `pnpm --filter @mycrm/web typecheck`
- relevant component and page tests for shell routing and navigation
- updated Playwright smoke for shell load and `/inbox` default flow

## Result Evaluation
The phase is successful only if all of the following are true:
- Route-based shell exists and is the default entry.
- Existing tested flows still work from the new shell.
- Product copy is improved for the migrated surfaces.
- No regression is introduced in settings save, export, restore, sync queueing, or draft queueing.
- Validation passes for the changed surface.

## Acceptance Criteria
- Operator lands in `/inbox` from `/`.
- Navigation is visible and stable.
- Inbox remains usable without hidden dependency on the old single-page entry.
- Placeholder routes are structured and visually consistent with the shell.
- The shell reads as a product workspace rather than a temporary internal tool.

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
### Phase 01 Report
- Scope completed:
- Main files changed:
- Validation run:
- Known limitations left for later phases:
- Migration or compatibility notes:
- Commit:

## Commit Format
- `phase-01: route-based crm shell`
