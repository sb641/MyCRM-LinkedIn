# Phase 07 Plan: Regression, Performance, And Release Readiness

Status: not started

## Goal
Run final regression, performance, and release-readiness validation for the Intercom-style redesign.

## Why This Phase Exists
The redesign is only complete if the new operator console is stable under real workflows and the critical regression set is green. This phase closes the program and turns the redesign into the default UX direction.

## In Scope
- full regression pass on critical workflows
- performance sanity check after layout refactors
- final documentation updates
- release checklist for redesigned UI

## Out Of Scope
- new feature work
- speculative polish not required for release readiness
- unrelated bug fixing outside the redesigned surfaces

## Target UX Outcome
- redesigned product is ready for daily use
- no critical workflow regression remains open
- documentation reflects the new shell and workspace model

## Likely Files To Touch
- `docs/intercom-style-redesign-master-plan.md`
- `docs/intercom-redesign-phases/*.md`
- screenshots or release notes if maintained in repo
- test files updated during earlier phases

## Implementation Checklist
- [ ] run full web typecheck
- [ ] run db typecheck if affected by redesign changes
- [ ] run targeted unit and component tests for changed surfaces
- [ ] run full critical E2E regression set
- [ ] update docs and screenshots if maintained in repo
- [ ] write final redesign completion report

## Critical Regression Set
- inbox smoke flow
- settings save and export flow
- generate draft flow
- bulk generate flow
- queue send flow
- ignore and restore flow
- account assign flow
- account merge flow
- workspace restore confirmation flow

## Acceptance Criteria
- critical workflows pass validation
- redesigned shell and workspaces are documented
- no known blocker remains for daily operator use

## Validation
Automated:
- `pnpm --filter @mycrm/web typecheck`
- `pnpm --filter @mycrm/db typecheck`
- relevant web tests for changed components and services
- full critical Playwright regression set for CRM shell

Manual:
- verify redesigned shell on common desktop widths
- verify operator can work continuously from queue to preview to draft to send without layout friction
- verify settings and destructive actions remain clear in the denser UI

## Exit Gate
The redesign program is complete only when the critical regression set is green and the redesigned UX is documented as the new default direction.

## Dependencies For Later Phases
This is the closing phase and depends on all prior phases being implemented and stabilized.