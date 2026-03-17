# Phase 06 Plan: Responsive And Edge-State Hardening

Status: not started

## Goal
Harden responsive behavior, collapse behavior, and all non-happy-path UI states introduced by the redesign.

## Why This Phase Exists
Dense operator layouts are fragile if overflow, empty states, and narrower desktop widths are not explicitly tested. This phase stabilizes the redesigned surfaces under realistic desktop conditions.

## In Scope
- stabilize shell collapse behavior
- stabilize overflow and truncation rules
- stabilize empty, loading, and error states in redesigned layouts
- ensure common laptop widths remain usable
- ensure modals and side panels still work with denser layouts

## Out Of Scope
- new product features
- major visual-system redesign beyond hardening
- backend contract changes unless required to support error-state rendering

## Target UX Outcome
- redesigned layouts remain usable on common desktop and laptop widths
- collapse behavior does not create broken or hidden controls
- empty and error states still feel intentional and readable

## Likely Files To Touch
- `apps/web/app/globals.css`
- shell components
- inbox, drafts, and accounts components
- modal components affected by spacing or overflow changes

## Implementation Checklist
- [ ] test and fix widths around 1280px, 1440px, and narrower laptop layouts
- [ ] fix truncation and overflow in dense lists and headers
- [ ] fix empty states for queue, drafts, accounts, and settings panels
- [ ] fix loading and error states for redesigned panels
- [ ] verify modal layering and focus behavior with collapsed shell
- [ ] verify long-content overflow in queue rows, thread headers, and account panels

## Acceptance Criteria
- no major layout breaks at common desktop widths
- collapse behavior remains stable across routes
- empty and error states remain readable and actionable
- dense layouts do not clip critical actions or metadata

## Validation
Automated:
- `pnpm --filter @mycrm/web typecheck`
- component tests for empty and error states where practical

E2E:
- smoke flows at default desktop viewport
- targeted flows at narrower desktop viewport if Playwright coverage is extended
- modal flows for bulk generate, reminder, ignore, and settings restore confirmation

Manual:
- verify shell collapse plus modal usage
- verify long-content overflow in queue rows, thread headers, and account panels
- verify empty queue, empty drafts, and API error states remain usable

## Exit Gate
Phase 07 must not start until redesigned layouts are stable under realistic desktop conditions.

## Dependencies For Later Phases
- depends on the redesigned surfaces from Phase 02 through Phase 05