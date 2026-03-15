# Phase 07 Plan: Campaigns

## Execution Order
1. Update TODOs first.
2. Execute the full phase scope.
3. Run the required validation.
4. Post the phase report in chat here.
5. Create the git commit for the phase.

## Objective
Add Campaigns as single-action outreach containers.

## Scope Summary
This phase introduces campaign entities and campaign UI for grouping outreach work around one objective without turning campaigns into sequences.

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
- Campaign statuses:
  - Draft
  - Active
  - Paused
  - Completed
- Campaign supports:
  - target list
  - one outreach objective
  - optional default prompt
  - reminder rules
  - optional tags
- Not a sequence builder.

## Phase Limitations
- Activity can initially be derived from drafts, reminders, and audit data.

## Reuse And Compatibility Guardrails
- Campaigns must group outreach work without introducing sequence automation.
- Reuse existing draft, reminder, and activity data where practical.
- Preserve manual approval and explicit send behavior.

## Files To Create
- `apps/web/lib/view-models/campaigns.ts`
- `apps/web/lib/services/campaigns-service.ts`
- `apps/web/app/(crm)/campaigns/page.tsx`
- `apps/web/app/(crm)/campaigns/[campaignId]/page.tsx`
- `apps/web/components/crm/campaigns/campaigns-page.tsx`
- `apps/web/components/crm/campaigns/campaign-list.tsx`
- `apps/web/components/crm/campaigns/campaign-detail-page.tsx`
- `apps/web/components/crm/campaigns/campaign-targets-tab.tsx`
- `apps/web/components/crm/campaigns/campaign-drafts-tab.tsx`
- `apps/web/components/crm/campaigns/campaign-reminders-tab.tsx`
- `apps/web/components/crm/campaigns/campaign-activity-tab.tsx`
- `apps/web/components/crm/campaigns/campaign-settings-tab.tsx`
- `apps/web/components/crm/modals/create-campaign-modal.tsx`
- `apps/web/components/crm/modals/add-to-campaign-modal.tsx`
- `apps/web/app/api/campaigns/route.ts`
- `apps/web/app/api/campaigns/[campaignId]/route.ts`
- `apps/web/app/api/campaigns/[campaignId]/targets/route.ts`
- `apps/web/app/api/campaigns/[campaignId]/targets/[targetId]/route.ts`

## Files To Update
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`

## Database Changes
- add `campaigns`
- add `campaign_targets`

## Implementation Checklist
- [ ] Start by updating TODOs and marking Phase 07 as in progress.
- [ ] Mark Phase 07 as in progress in the active TODO list.
- [ ] Verify reusable draft, reminder, and activity reads.
- [ ] Add campaign schema and repository support.
- [ ] Build campaigns list and detail surfaces.
- [ ] Add create campaign and target assignment flows.
- [ ] Keep campaign model single-action, not sequence-based.
- [ ] Add campaign APIs.
- [ ] Write phase report.
- [ ] Create focused git commit.

## Validation And Tests
Required validation:
- db typecheck
- web typecheck
- campaign API tests
- repository tests
- E2E for campaign target and draft flow

Suggested concrete validation set:
- `pnpm --filter @mycrm/db typecheck`
- `pnpm --filter @mycrm/web typecheck`
- targeted API and repository tests for campaign lifecycle and targets
- Playwright flow for campaign target assignment and draft work

## Result Evaluation
The phase is successful only if all of the following are true:
- Campaigns group outreach work without becoming sequences.
- Campaign target and detail flows are usable.
- Validation passes for DB, API, repository, and UI behavior.

## Acceptance Criteria
- Operator can create a campaign with one outreach objective.
- Operator can add targets to a campaign.
- Campaign detail shows drafts, reminders, activity, and settings at the intended phase scope.
- No sequence-builder behavior is introduced.

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
### Phase 07 Report
- Scope completed:
- Main files changed:
- Validation run:
- Known limitations left for later phases:
- Migration or compatibility notes:
- Commit:

## Commit Format
- `phase-07: add campaigns`
