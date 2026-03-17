# Phase 01 Plan: Shell And Collapsible Navigation

Status: implemented, use as verification baseline

## Goal
Keep the CRM shell compact, route-stable, and Intercom-like, with collapsible left navigation that reclaims horizontal space for operator work.

## Why This Phase Exists
The shell defines the spatial model for every later redesign phase. Inbox, Drafts, and Accounts cannot become dense operator workspaces if the application frame remains visually heavy or structurally unstable.

## In Scope
- global shell layout
- collapsible primary navigation
- reduced visual weight of navigation and top-level chrome
- removal of hero-banner behavior from daily work routes
- stable route framing across CRM pages

## Out Of Scope
- inbox three-column redesign
- draft workspace redesign
- accounts workspace redesign
- shared visual-system normalization beyond shell-level changes

## Current Implementation Notes
This phase appears already implemented in the codebase and should be treated as a baseline to preserve:
- shell state persists collapsed and expanded navigation state in local storage
- navigation supports compact and expanded modes
- topbar and page frame are compact rather than hero-like
- globals include tighter shell spacing and responsive fallback behavior

## Target UX Outcome
- left navigation can collapse to a narrow rail
- content area gains more horizontal space
- shell feels like a product workspace instead of a dashboard
- top-level actions remain accessible without dominating the screen

## Likely Files To Touch If Revisited
- `apps/web/components/crm/app-shell/crm-app-shell.tsx`
- `apps/web/components/crm/app-shell/crm-nav.tsx`
- `apps/web/components/crm/app-shell/crm-topbar.tsx`
- `apps/web/components/crm/app-shell/crm-page-frame.tsx`
- `apps/web/app/globals.css`
- route-level page wrappers that depend on shell framing

## Implementation Checklist
- [x] add shell state for collapsed and expanded navigation
- [x] redesign nav into compact rail plus optional expanded labels
- [x] reduce shell padding and border radius
- [x] remove oversized route hero treatment from daily work pages
- [x] preserve route navigation and active-state clarity
- [x] ensure keyboard and pointer access still work for navigation
- [ ] verify the shell remains stable while later phases change page internals

## Acceptance Criteria
- left sidebar can collapse and expand without breaking navigation
- collapsed state preserves icons or compact labels sufficient for navigation
- shell uses materially less horizontal space than the previous version
- top-level layout remains stable across Inbox, Drafts, Accounts, Campaigns, LinkedIn, and Settings
- no existing route becomes harder to reach than before

## Validation
Automated:
- `pnpm --filter @mycrm/web typecheck`
- route rendering tests for shell layout wrappers
- component tests for shell collapse state if shell logic changes

E2E:
- verify navigation still reaches `/inbox`, `/accounts`, `/campaigns`, `/drafts`, `/linkedin`, `/settings`
- verify collapse and expand control changes layout without breaking page content

Manual:
- verify collapsed shell gives visibly more room to the main workspace
- verify active route remains obvious in both expanded and collapsed states
- verify shell does not visually dominate the page

## Exit Gate
Phase 02 should treat this shell as stable infrastructure and must not regress collapse behavior or route reachability.

## Dependencies For Later Phases
- Phase 02 depends on the shell being compact and stable
- Phase 03 and Phase 04 depend on the shell preserving horizontal space for dense work surfaces