# Phase 03 Plan: Draft Workspace Redesign

Status: not started

## Goal
Redesign Drafts into a compact review workspace aligned with the new Inbox interaction model.

## Why This Phase Exists
Draft review is a core operator workflow. If Drafts remains visually secondary or oversized, operators will still be forced back into Inbox for focused review work and the product will lose workflow clarity.

## In Scope
- redesign drafts list and filters
- redesign draft preview and editing surface
- align draft actions with the new shell and panel system
- improve readability of approval and send-readiness states
- surface linked person, account, and campaign context in a compact side panel

## Out Of Scope
- account-level ABM redesign
- app-wide visual-system normalization beyond Drafts needs locally
- responsive hardening beyond the main desktop target

## Target UX Outcome
- draft review feels like a focused operator workflow, not a secondary page
- approved, pending, sent, and failed states are easy to scan
- editing and approval actions are visible without oversized controls
- operator can move from draft review to linked thread context efficiently

## Likely Files To Touch
- `apps/web/app/(crm)/drafts/page.tsx`
- `apps/web/components/crm/drafts/draft-actions.tsx`
- draft page components introduced in earlier redesign phases
- `apps/web/app/globals.css`

## Implementation Checklist
- [ ] redesign draft list density and grouping
- [ ] redesign draft preview and editor surface
- [ ] align action hierarchy for edit, approve, send, and open thread
- [ ] surface linked person, account, and campaign context in a compact side panel
- [ ] preserve existing send approval rules and queue-send behavior
- [ ] verify long draft text remains readable at smaller type sizes
- [ ] verify failed and sent states remain distinguishable

## Acceptance Criteria
- draft list is denser and easier to scan
- draft preview is readable without excessive whitespace
- approval and send actions are clear but not visually dominant
- operator can move from draft review to linked thread context efficiently

## Validation
Automated:
- `pnpm --filter @mycrm/web typecheck`
- draft page tests
- draft action component tests

E2E:
- review and approve flow
- queue send flow
- open linked thread flow if supported from Drafts page

Manual:
- verify long draft text remains readable
- verify failed and sent states remain distinguishable at smaller type sizes
- verify editing does not cause layout jumps or clipped controls

## Exit Gate
Phase 04 must not start until Drafts matches the density and interaction model of the redesigned Inbox.

## Dependencies For Later Phases
- depends on Phase 01 shell stability
- should align with the interaction model established in Phase 02