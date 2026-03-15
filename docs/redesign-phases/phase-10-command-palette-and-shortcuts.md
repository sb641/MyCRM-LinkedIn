# Phase 10 Plan: Command Palette And Keyboard Shortcuts

## Execution Order
1. Update TODOs first.
2. Execute the full phase scope.
3. Run the required validation.
4. Post the phase report in chat here.
5. Create the git commit for the phase.

## Objective
Add command palette and keyboard shortcuts.

## Scope Summary
This phase improves desktop operator speed with a command palette and guarded keyboard shortcuts for queue navigation and draft actions.

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
- Cmd/Ctrl + K -> command palette
- J / K -> move queue selection
- Enter -> open selected thread
- Shift + X -> toggle multi-select mode
- R -> set reminder
- E -> edit selected draft
- A -> approve selected draft
- S -> send approved draft
- I -> open delete and ignore confirmation

## Phase Limitations
- Shortcuts must not fire while typing in inputs, textareas, or editable fields.
- Command palette should focus on core actions first.

## Reuse And Compatibility Guardrails
- Reuse existing page actions rather than duplicating business logic.
- Keep shortcuts desktop-first and non-invasive.
- Ensure keyboard actions respect manual approval and destructive-action confirmation flows.

## Files To Create
- `apps/web/components/crm/app-shell/command-palette.tsx`
- `apps/web/components/crm/app-shell/shortcut-provider.tsx`
- `apps/web/lib/shortcuts.ts`
- `apps/web/lib/commands.ts`
- `apps/web/lib/use-global-shortcuts.ts`

## Files To Update
- `apps/web/components/crm/app-shell/crm-app-shell.tsx`
- Inbox and Drafts pages to expose selection state and actions

## Implementation Checklist
- [ ] Start by updating TODOs and marking Phase 10 as in progress.
- [ ] Mark Phase 10 as in progress in the active TODO list.
- [ ] Verify reusable page actions and selection state.
- [ ] Add command palette and shortcut provider.
- [ ] Add global shortcut definitions and hook.
- [ ] Expose Inbox and Drafts actions to the shortcut layer.
- [ ] Guard shortcuts from firing in editable fields.
- [ ] Preserve manual approval and confirmation flows.
- [ ] Write phase report.
- [ ] Create focused git commit.

## Validation And Tests
Required validation:
- web typecheck
- shortcut tests
- command palette tests
- E2E for keyboard navigation

Suggested concrete validation set:
- `pnpm --filter @mycrm/web typecheck`
- targeted tests for shortcut dispatch and editable-field guards
- command palette tests for core actions
- Playwright flow for keyboard navigation and action triggering

## Result Evaluation
The phase is successful only if all of the following are true:
- Desktop workflow is fast and reliable.
- Shortcuts do not fire while typing in editable fields.
- Keyboard actions reuse existing page actions safely.
- Validation passes for the changed surface.

## Acceptance Criteria
- Operator can open the command palette with Cmd/Ctrl + K.
- Queue selection can be moved with J and K.
- Draft and reminder actions can be triggered from the keyboard where supported.
- Delete and Ignore still requires the intended confirmation flow.

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
### Phase 10 Report
- Scope completed:
- Main files changed:
- Validation run:
- Known limitations left for later phases:
- Migration or compatibility notes:
- Commit:

## Commit Format
- `phase-10: add command palette and shortcuts`
