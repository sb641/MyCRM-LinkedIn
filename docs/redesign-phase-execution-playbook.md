# Redesign Phase Execution Playbook

This file is the execution contract for the CRM redesign work.

It is not a product brief. It is the operational playbook the agent must follow for every phase.

## Mandatory Execution Rules

For every phase, execution must follow this order:

1. Update TODOs first.
2. Re-read the current phase section in this file before coding.
3. Implement the full phase without asking the user avoidable questions.
4. Run validation for the changed surface.
5. Write a short phase report.
6. Commit the phase to git with a focused commit message.

The agent must not stop after planning once a phase is started.

The agent must not ask the user to manually test routine flows if the repo already contains enough tooling to validate them.

The agent must preserve these constraints across all phases:

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

## Global Phase Template

Every phase must be executed in this exact structure.

### 1. TODO Update

Before editing code:

- Mark the current phase as `in-progress` in the active TODO list.
- Add concrete sub-tasks for schema, API, UI, tests, docs, and validation when relevant.
- Keep only one phase `in-progress` at a time.

### 2. Implementation Guardrails

Before coding, verify:

- Which existing files can be reused.
- Which APIs already exist and must remain backward-compatible.
- Which tests already cover the affected flows.
- Whether backup and restore must be updated for the phase.
- Whether worker or importer behavior is affected.

### 3. Full Implementation

Complete the whole phase scope, not a partial scaffold, unless a hard technical blocker is discovered.

If a blocker exists, the agent must still complete all non-blocked work in the phase before stopping.

### 4. Validation

Run the smallest reliable validation set that proves the phase works:

- typecheck for affected packages
- unit tests for changed services and components
- integration tests for schema and repository changes
- E2E for user-visible workflow changes when applicable

### 5. Phase Report

After validation, write a concise report containing:

- what changed
- what was validated
- known limitations left intentionally for later phases
- any migration or compatibility notes

### 6. Git Commit

After a successful phase, create a focused git commit.

Commit format:

- `phase-01: route-based crm shell`
- `phase-02: redesign inbox workspace`
- `phase-03: add drafts review page`

Do not amend unless explicitly requested.

## Phase 1

### Goal

Create the new route-based CRM shell and move the current single-page workspace into the new navigation structure.

### Requirements

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

### Limitations

- No new DB entities in this phase.
- Accounts, Campaigns, Drafts, LinkedIn, and Settings pages may start as structured placeholders if their full feature work belongs to later phases.
- The old `crm-shell.tsx` may remain temporarily as an internal implementation detail, but the route structure must be real.

### Files To Create

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

### Files To Update

- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/app/page.test.tsx`
- `apps/web/e2e/crm-shell.spec.ts`
- `apps/web/app/crm-shell.tsx` only if needed to extract or wrap legacy content

### Reuse Strategy

- Reuse current server-side data assembly from `apps/web/app/page.tsx`.
- Reuse current services in `apps/web/lib/services`.
- Reuse current APIs unchanged where possible.
- Reuse current shell state and view-model logic until later phases split it further.

### Validation Required

- web typecheck
- relevant web tests
- E2E smoke flow updated for `/inbox`

### Done Criteria

- Route-based shell exists and is the default entry.
- Existing tested flows still work.
- Product copy is improved for the migrated surfaces.
- Phase report written.
- Git commit created.

## Phase 2

### Goal

Redesign Inbox into the main daily operating surface with queue, conversation workspace, and context panel.

### Requirements

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

### Limitations

- Account and Campaign context tabs may be partial until later phases add full entities.
- Queue toggle can initially degrade gracefully when account data is missing.

### Files To Create

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

### Files To Update

- `apps/web/app/(crm)/inbox/page.tsx`
- `apps/web/lib/services/inbox-service.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/app/api/inbox/route.ts` if filter/query support is added

### DB Changes

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

### Validation Required

- db typecheck
- web typecheck
- inbox view-model tests
- inbox service tests
- updated inbox E2E smoke

### Done Criteria

- Inbox becomes the main operating surface.
- Existing draft and send flows still work.
- New fields are added without breaking backup and restore.
- Phase report written.
- Git commit created.

## Phase 3

### Goal

Add a dedicated Drafts review page.

### Requirements

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

### Limitations

- Campaign and Account filters may be partial until those entities are implemented.
- Edit can initially mean editing approved text rather than a full rich editor.

### Files To Create

- `apps/web/lib/view-models/drafts.ts`
- `apps/web/app/(crm)/drafts/page.tsx`
- `apps/web/components/crm/drafts/drafts-page.tsx`
- `apps/web/components/crm/drafts/drafts-toolbar.tsx`
- `apps/web/components/crm/drafts/drafts-filters.tsx`
- `apps/web/components/crm/drafts/draft-list.tsx`
- `apps/web/components/crm/drafts/draft-row.tsx`
- `apps/web/components/crm/drafts/draft-group.tsx`
- `apps/web/app/api/drafts/route.ts` if needed

### Files To Update

- `apps/web/lib/services/crm-service.ts`
- `packages/db/src/repositories.ts`

### Validation Required

- web typecheck
- draft page tests
- draft API tests if added
- E2E for review and send flow

### Done Criteria

- Draft review can be done outside Inbox.
- Approval and send reuse existing backend flow.
- Phase report written.
- Git commit created.

## Phase 4

### Goal

Add bulk draft generation from selected people.

### Requirements

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

### Limitations

- Initial implementation may orchestrate repeated single-contact generation under the hood.
- No auto-approval or auto-send.

### Files To Create

- `apps/web/components/crm/modals/bulk-draft-modal.tsx`
- `apps/web/app/api/drafts/bulk-generate/route.ts`

### Files To Update

- `apps/web/components/crm/inbox/inbox-queue.tsx`
- `apps/web/components/crm/inbox/inbox-toolbar.tsx`
- `apps/web/components/crm/inbox/inbox-row-person.tsx`
- `apps/web/lib/services/crm-service.ts`
- `packages/db/src/repositories.ts`

### Validation Required

- web typecheck
- bulk generate API tests
- component tests for selection and modal flow
- E2E for multi-select and bulk generation

### Done Criteria

- User can select multiple people and generate drafts in one action.
- Phase report written.
- Git commit created.

## Phase 5

### Goal

Add Accounts and manual ABM grouping.

### Requirements

- Users can assign people into logical accounts.
- Users can create accounts manually.
- Users can merge accounts manually.
- Source names must be preserved as aliases.
- Stakeholder map must be lane-based:
  - Executive
  - Director
  - Manager / Other
  - Unclassified

### Limitations

- No auto-merge without user confirmation.
- Coverage signals can be rule-based in v1.

### Files To Create

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

### Files To Update

- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`

### DB Changes

- add `accounts`
- add `account_aliases`

### Validation Required

- db typecheck
- web typecheck
- account API tests
- repository integration tests for merge and aliases
- E2E for assign and merge flow

### Done Criteria

- Contacts can be assigned to logical accounts.
- Accounts can be merged safely.
- Aliases are preserved.
- Phase report written.
- Git commit created.

## Phase 6

### Goal

Add reminders.

### Requirements

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

### Limitations

- Prefer one active reminder per entity in v1 for simplicity.

### Files To Create

- `apps/web/lib/services/reminders-service.ts`
- `apps/web/components/crm/modals/reminder-modal.tsx`
- `apps/web/components/crm/shared/reminder-badge.tsx`
- `apps/web/app/api/reminders/route.ts`
- `apps/web/app/api/reminders/[reminderId]/route.ts`

### Files To Update

- `apps/web/lib/view-models/inbox.ts`
- `apps/web/lib/view-models/accounts.ts`
- `apps/web/lib/view-models/account-detail.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`

### DB Changes

- add `reminders`

### Validation Required

- db typecheck
- web typecheck
- reminder API tests
- repository tests
- E2E for reminder set and due state

### Done Criteria

- Reminder state is visible and actionable.
- Phase report written.
- Git commit created.

## Phase 7

### Goal

Add Campaigns as single-action outreach containers.

### Requirements

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

### Limitations

- Activity can initially be derived from drafts, reminders, and audit data.

### Files To Create

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

### Files To Update

- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`

### DB Changes

- add `campaigns`
- add `campaign_targets`

### Validation Required

- db typecheck
- web typecheck
- campaign API tests
- repository tests
- E2E for campaign target and draft flow

### Done Criteria

- Campaigns group outreach work without becoming sequences.
- Phase report written.
- Git commit created.

## Phase 8

### Goal

Implement Delete and Ignore forever.

### Requirements

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

### Limitations

- Restore should prefer reactivating soft-deleted records.
- If older data was hard-deleted before this phase, restore may be partial.

### Files To Create

- `apps/web/lib/services/suppressions-service.ts`
- `apps/web/app/api/contacts/[contactId]/ignore/route.ts`
- `apps/web/app/api/suppressions/route.ts`
- `apps/web/app/api/suppressions/[suppressionId]/restore/route.ts`
- `apps/web/components/crm/modals/delete-ignore-modal.tsx`
- `apps/web/components/crm/settings/ignored-people-panel.tsx`

### Files To Update

- `apps/web/app/(crm)/settings/page.tsx`
- `apps/web/components/crm/inbox/inbox-row-person.tsx`
- `apps/web/components/crm/inbox/conversation-header.tsx`
- `apps/web/components/crm/inbox/context-person-tab.tsx`
- `apps/web/components/crm/drafts/draft-row.tsx`
- worker import path files
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- backup and restore logic in settings repository path

### DB Changes

- add `sync_suppressions`
- use `deletedAt` fields added earlier

### Validation Required

- db typecheck
- web typecheck
- suppression API tests
- importer suppression integration tests
- E2E for ignore and restore flow

### Done Criteria

- Ignored people do not come back after sync.
- Restore works from Settings.
- Phase report written.
- Git commit created.

## Phase 9

### Goal

Add tags and lightweight productivity polish.

### Requirements

- Tags must work across contacts, accounts, and campaigns at minimum.
- Inbox and Drafts filters must support tags.

### Limitations

- Keep tag color system simple in v1.

### Files To Create

- `apps/web/lib/services/tags-service.ts`
- `apps/web/components/crm/shared/tag-chip.tsx`
- `apps/web/components/crm/modals/tag-assignment-modal.tsx`
- `apps/web/app/api/tags/route.ts`
- `apps/web/app/api/tags/assign/route.ts`

### Files To Update

- inbox, drafts, accounts, campaigns view-models
- relevant list rows and filters
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`

### DB Changes

- add `tags`
- add `entity_tags`

### Validation Required

- db typecheck
- web typecheck
- tag API tests
- filter tests

### Done Criteria

- Tags can be assigned and filtered.
- Phase report written.
- Git commit created.

## Phase 10

### Goal

Add command palette and keyboard shortcuts.

### Requirements

- Cmd/Ctrl + K -> command palette
- J / K -> move queue selection
- Enter -> open selected thread
- Shift + X -> toggle multi-select mode
- R -> set reminder
- E -> edit selected draft
- A -> approve selected draft
- S -> send approved draft
- I -> open delete and ignore confirmation

### Limitations

- Shortcuts must not fire while typing in inputs, textareas, or editable fields.
- Command palette should focus on core actions first.

### Files To Create

- `apps/web/components/crm/app-shell/command-palette.tsx`
- `apps/web/components/crm/app-shell/shortcut-provider.tsx`
- `apps/web/lib/shortcuts.ts`
- `apps/web/lib/commands.ts`
- `apps/web/lib/use-global-shortcuts.ts`

### Files To Update

- `apps/web/components/crm/app-shell/crm-app-shell.tsx`
- Inbox and Drafts pages to expose selection state and actions

### Validation Required

- web typecheck
- shortcut tests
- command palette tests
- E2E for keyboard navigation

### Done Criteria

- Desktop workflow is fast and reliable.
- Phase report written.
- Git commit created.

## Phase Report Template

After each phase, append a short report to the working notes or final response using this structure:

### Phase N Report

- Scope completed:
- Main files changed:
- Validation run:
- Known limitations left for later phases:
- Commit:
