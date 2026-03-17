# Phase 05 Plan: Shared Visual System And Density Pass

Status: not started

## Goal
Normalize the visual system across all CRM surfaces so the product feels coherent and intentionally designed.

## Why This Phase Exists
If each route is redesigned independently, styling divergence will return. This phase consolidates typography, spacing, panels, controls, and feedback states into one consistent CRM visual language.

## In Scope
- unify typography scale
- unify spacing scale
- unify panel, border, and shadow rules
- unify button, tab, filter, and form-control styles
- unify empty, loading, and inline feedback states
- remove remaining legacy decorative styles from CRM routes

## Out Of Scope
- major workflow redesigns already covered by earlier phases
- responsive hardening beyond what is needed to keep the shared system stable
- backend or business-rule changes

## Target UX Outcome
- the product feels like one system instead of route-specific styling experiments
- controls behave consistently across Inbox, Drafts, Accounts, Campaigns, LinkedIn, and Settings
- visual density is stable across the app

## Likely Files To Touch
- `apps/web/app/globals.css`
- shared shell components
- shared modal components
- shared badges, chips, and form controls
- route-specific components that still use legacy styling

## Implementation Checklist
- [ ] define and apply shared typography tokens
- [ ] define and apply shared spacing tokens
- [ ] normalize panel and control styling
- [ ] normalize inline messages, badges, and status chips
- [ ] remove remaining legacy decorative styles from CRM routes
- [ ] verify compact controls remain accessible and readable

## Acceptance Criteria
- typography is consistent across all major routes
- controls and panels share the same visual language
- no major CRM route still looks like the old editorial shell
- density remains readable and stable across surfaces

## Validation
Automated:
- `pnpm --filter @mycrm/web typecheck`
- component tests for shared controls if behavior changes

E2E:
- smoke navigation across all major routes
- settings save and export flow
- send queue flow
- ignore and restore flow

Manual:
- verify visual consistency across Inbox, Drafts, Accounts, Campaigns, LinkedIn, and Settings
- verify compact controls remain accessible and readable
- verify status colors and badges remain distinguishable

## Exit Gate
Phase 06 must not start until the visual system is coherent across the product.

## Dependencies For Later Phases
- depends on the route-level redesign work from Phase 02 through Phase 04