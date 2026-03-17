# Phase 04 Plan: Accounts Workspace Redesign

Status: not started

## Goal
Redesign Accounts so account mode becomes a practical ABM workspace rather than a secondary view.

## Why This Phase Exists
Account mode is currently at risk of feeling like a side feature. The redesign needs to make account-level planning, stakeholder review, assignment, and merge work feel first-class and consistent with Inbox and Drafts.

## In Scope
- redesign account list and account detail layout
- improve stakeholder map readability
- improve account merge and assignment ergonomics
- align account detail panels with the new shell and context model
- keep account metadata, aliases, reminders, and campaign links readable in dense layouts

## Out Of Scope
- app-wide visual-system normalization beyond Accounts needs locally
- responsive hardening beyond the main desktop target
- changes to core account business rules

## Target UX Outcome
- account mode is usable for stakeholder review and account-level planning
- merge and assignment actions are easier to understand and execute
- account detail view feels consistent with Inbox and Drafts

## Likely Files To Touch
- account pages and account components introduced in prior phases
- `apps/web/components/crm/inbox/inbox-workspace.tsx` for shared account-mode presentation if still used
- `apps/web/app/globals.css`

## Implementation Checklist
- [ ] redesign account list density and hierarchy
- [ ] redesign stakeholder lanes for compact readability
- [ ] redesign account action area for assign and merge flows
- [ ] align account detail metadata with right-panel conventions
- [ ] preserve account assignment and merge behavior
- [ ] verify account detail remains usable with many stakeholders
- [ ] verify aliases and metadata do not overflow or disappear

## Acceptance Criteria
- account list is scannable and compact
- stakeholder map is readable without oversized cards
- assign and merge actions are discoverable and usable
- account detail layout supports ABM workflows without visual clutter

## Validation
Automated:
- `pnpm --filter @mycrm/web typecheck`
- account component tests
- account service or view-model tests if presentation refactor changes assumptions

E2E:
- assign contact to account flow
- merge accounts flow
- account-mode navigation and selection flow

Manual:
- verify account detail remains usable with many stakeholders
- verify merge controls remain clear in compact layout
- verify account aliases and metadata do not overflow or disappear

## Exit Gate
Phase 05 must not start until Accounts is visually and operationally aligned with the redesigned Inbox.

## Dependencies For Later Phases
- depends on Phase 01 shell stability
- should align with the workspace model established in Phase 02 and Phase 03