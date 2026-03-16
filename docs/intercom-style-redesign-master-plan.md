# Intercom-Style Redesign Master Plan

This document is the project-level execution plan for redesigning the MyCRM web workspace into a lighter, denser, Intercom-style operator console while preserving the existing product logic, backend contracts, and validated workflows.

It is intentionally separate from the existing redesign phase files.

Those files describe the functional CRM rebuild that has already been implemented.

This document defines the next redesign program focused on:

- layout logic
- operator ergonomics
- visual density
- navigation behavior
- preview and draft usability
- lead-list productivity
- consistency with the Intercom-like direction requested in the product brief

## Document Purpose

Use this file as the master project document for the Intercom-style redesign.

It should be used to:

1. sequence the redesign safely without a full rewrite
2. preserve existing tested business behavior
3. define acceptance criteria for each redesign phase
4. define validation and regression coverage for each phase
5. keep visual redesign work aligned with operator workflows instead of decorative UI changes

## Product Direction

The target experience is not a pixel copy of Intercom.

The target is a CRM workspace that follows the same operating logic:

- compact navigation
- dense information layout
- list-first workflow
- central thread and draft workspace
- persistent context/details panel
- smaller typography
- lower visual noise
- faster scanning and action-taking
- collapsible left navigation to reclaim horizontal space

## Why A New Redesign Program Is Needed

The current shell and inbox presentation are functional but visually and structurally misaligned with the intended operator workflow.

Current issues observed in the existing UI:

- oversized serif typography reduces information density
- large decorative cards consume space needed for queue, preview, and draft work
- left navigation is visually heavy and not collapsible
- top hero treatment behaves like a dashboard banner instead of a CRM control surface
- queue, preview, and context areas do not yet feel like a tightly integrated operator console
- drafts and previews are present but not framed as the primary daily workflow

## Non-Negotiable Constraints

These constraints apply to every phase in this redesign program.

- No full rewrite.
- Reuse existing backend, APIs, worker, and tested flows wherever possible.
- Preserve server-side read assembly and client-side mutation patterns unless a phase explicitly requires a safe refactor.
- Keep all current business rules intact.
- Keep manual approval required for every outgoing message.
- Keep Delete and Ignore semantics as soft-delete plus suppression plus restore.
- Keep desktop-first UX.
- Keep one LinkedIn account per workspace.
- Keep future compatibility with Vercel plus Postgres-like deployment.
- Do not regress existing E2E-covered flows while changing layout and presentation.

## Design Principles

Every redesign decision should be evaluated against these principles.

### 1. Operator First

The screen must optimize for repeated daily work, not for visual flourish.

### 2. Density Without Clutter

More information should fit on screen, but hierarchy must remain obvious.

### 3. Stable Spatial Model

The operator should always know where to find:

- navigation
- queue/list
- active thread or preview
- draft tools
- context/details

### 4. Progressive Disclosure

Secondary controls should not dominate the screen until needed.

### 5. Functional Continuity

Existing actions must remain reachable during and after redesign.

### 6. Intercom-Like Logic, Not Visual Mimicry

Borrow the operating model, density, and panel behavior, not brand-specific assets.

## Target Information Architecture

The target desktop shell should converge toward this structure.

### Global Shell

- Left rail:
  - compact product rail
  - primary sections
  - collapse/expand control
- Secondary sidebar:
  - queue tabs
  - filters
  - list controls
  - list content
- Main workspace:
  - thread header or account header
  - conversation preview or account preview
  - draft composer and draft actions
- Right context panel:
  - person details
  - account details
  - campaign details
  - operational metadata

### Inbox Operating Model

- left: queue and lead list
- center: conversation preview plus draft workspace
- right: context and operational details

### Drafts Operating Model

- left: draft filters and grouped list
- center: draft preview and editing surface
- right: linked person/account/campaign context and send readiness

### Accounts Operating Model

- left: account list
- center: account overview and stakeholder map
- right: account metadata, aliases, reminders, and campaign links

## Typography And Visual System Direction

The redesign should move from editorial styling to CRM styling.

### Typography

- Replace serif-first typography with a neutral sans-serif stack.
- Reduce heading scale substantially.
- Reduce body size to a normal CRM density.
- Use weight, spacing, and muted color for hierarchy instead of oversized type.

### Spacing

- Reduce panel padding.
- Reduce vertical whitespace in lists.
- Standardize compact row heights.
- Keep enough spacing for readability, but remove decorative emptiness.

### Surfaces

- Replace oversized rounded cards with flatter, tighter panels.
- Use subtle borders and restrained shadows.
- Keep background calm and low-contrast.
- Remove hero-banner feeling from daily work surfaces.

### Controls

- Use compact segmented controls, tabs, filters, and action buttons.
- Keep primary CTA visible but not oversized.
- Move secondary actions into menus where appropriate.

## Program Status Legend

- `[x]` completed
- `[-]` in progress
- `[ ]` not started
- `[!]` blocked or needs review

## Phase Overview

| Status | Phase | Name | Primary Outcome |
|---|---:|---|---|
| [ ] | 0 | UX Baseline and Redesign Guardrails | Freeze target patterns, metrics, and regression boundaries |
| [ ] | 1 | Shell Refactor and Collapsible Navigation | Intercom-like shell with collapsible left navigation |
| [ ] | 2 | Inbox Layout Overhaul | Dense three-column inbox optimized for leads, preview, and drafts |
| [ ] | 3 | Draft Workspace Redesign | Draft review and editing become first-class operator workflows |
| [ ] | 4 | Accounts Workspace Redesign | Account mode becomes usable as an ABM operating surface |
| [ ] | 5 | Shared Visual System and Density Pass | Typography, spacing, controls, and panels normalized across CRM |
| [ ] | 6 | Responsive and Edge-State Hardening | Collapse behavior, overflow, empty states, and error states stabilized |
| [ ] | 7 | Regression, Performance, and Release Readiness | Final validation of redesigned product surfaces |

## Phase 0

Status: `[ ] Not started`

### Goal

Define the redesign contract before implementation so visual work does not drift and functional regressions are easier to detect.

### Scope

- audit current shell, inbox, drafts, and accounts surfaces
- define target layout patterns for desktop
- define density targets for typography, row heights, and panel spacing
- define which existing flows are critical and must remain stable during redesign
- define visual tokens and component rules for the redesign program

### Deliverables

- redesign brief aligned to Intercom-style operator logic
- inventory of current UI pain points
- target desktop wireframe descriptions for Inbox, Drafts, and Accounts
- density and typography token proposal
- regression-critical workflow list

### Acceptance Criteria

- redesign goals are explicit and testable
- target shell structure is documented
- critical workflows are listed and prioritized
- typography and spacing direction is documented before code changes begin

### Tests And Validation

Automated:

- no code changes required unless documentation tests or snapshots are introduced

Manual review:

- verify the redesign brief covers Inbox, Drafts, Accounts, Settings, and shared shell behavior
- verify the list of critical workflows includes queue selection, preview, draft generation, send queueing, ignore/restore, account assignment, and account merge
- verify the collapse behavior and density goals are explicitly documented

### Exit Gate

Phase 1 must not start until the shell target and regression-critical workflows are documented.

## Phase 1

Status: `[ ] Not started`

### Goal

Replace the current heavy shell with a compact Intercom-like application frame and add collapsible left navigation.

### Scope

- redesign global shell layout
- add collapsible primary navigation
- reduce visual weight of global navigation and top-level chrome
- remove hero-banner behavior from daily work routes
- preserve route structure and existing navigation destinations

### Primary UX Outcomes

- left navigation can collapse to a narrow rail
- content area gains more horizontal space
- shell feels like a product workspace instead of a dashboard
- top-level actions remain accessible without dominating the screen

### Likely Files To Update

- `apps/web/components/crm/app-shell/crm-app-shell.tsx`
- `apps/web/components/crm/app-shell/crm-nav.tsx`
- `apps/web/components/crm/app-shell/crm-topbar.tsx`
- `apps/web/components/crm/app-shell/crm-page-frame.tsx`
- `apps/web/app/globals.css`
- route-level page wrappers that currently depend on hero-style framing

### Implementation Checklist

- [ ] add shell state for collapsed and expanded navigation
- [ ] redesign nav into compact rail plus optional expanded labels
- [ ] reduce shell padding and border radius
- [ ] remove oversized route hero treatment from daily work pages
- [ ] preserve route navigation and active-state clarity
- [ ] ensure keyboard and pointer access still work for navigation

### Acceptance Criteria

- left sidebar can collapse and expand without breaking navigation
- collapsed state preserves icons or compact labels sufficient for navigation
- shell uses materially less horizontal space than the current version
- top-level layout remains stable across Inbox, Drafts, Accounts, Campaigns, LinkedIn, and Settings
- no existing route becomes harder to reach than before

### Tests And Validation

Automated:

- `pnpm --filter @mycrm/web typecheck`
- component tests for shell collapse state if shell logic is extracted
- route rendering tests for shell layout wrappers

E2E:

- verify navigation still reaches `/inbox`, `/accounts`, `/campaigns`, `/drafts`, `/linkedin`, `/settings`
- verify collapse and expand control changes layout without breaking current page content

Manual:

- verify collapsed shell gives visibly more room to the main workspace
- verify active route remains obvious in both expanded and collapsed states
- verify shell does not visually dominate the page

### Exit Gate

Phase 2 must not start until the shell is compact, collapsible, and stable across routes.

## Phase 2

Status: `[ ] Not started`

### Goal

Rebuild Inbox into a dense three-column operator workspace optimized for lead lists, preview, and drafts.

### Scope

- redesign queue/list column
- redesign center conversation workspace
- redesign right context panel
- reduce oversized cards and whitespace
- make preview and draft work possible without constant scrolling or context loss

### Primary UX Outcomes

- operator can scan many leads quickly
- operator can keep thread context visible while drafting
- operator can access person/account context without leaving the thread
- queue, preview, and context feel like one integrated workspace

### Target Layout

- left column:
  - queue tabs
  - people/accounts toggle
  - filters
  - sort controls
  - dense lead list
- center column:
  - conversation header
  - message timeline or account preview
  - draft composer
  - draft variants and actions
- right column:
  - person details
  - account details
  - campaign context
  - reminders and operational metadata

### Likely Files To Update

- `apps/web/components/crm/inbox/inbox-workspace.tsx`
- `apps/web/lib/view-models/inbox.ts`
- inbox-related subcomponents if extracted during refactor
- `apps/web/app/(crm)/inbox/page.tsx`
- `apps/web/app/globals.css`

### Implementation Checklist

- [ ] convert inbox from large-card composition to dense panel composition
- [ ] reduce queue row height and tighten metadata layout
- [ ] keep selected thread visible and visually anchored
- [ ] keep draft composer visible in the main working area
- [ ] keep context panel persistent on desktop
- [ ] ensure account mode still works inside the new layout
- [ ] preserve ignore, reminder, generate, bulk-generate, send, and sync actions

### Acceptance Criteria

- queue list supports fast scanning with smaller typography and tighter rows
- selected conversation or account is visually obvious
- draft generation and review remain in the main working surface
- right context panel remains useful and readable without overwhelming the screen
- no critical inbox action is lost during redesign

### Tests And Validation

Automated:

- `pnpm --filter @mycrm/web typecheck`
- inbox component tests for selection, queue rendering, and action visibility
- inbox view-model tests if layout refactor changes derived state usage

E2E:

- smoke flow for `/inbox`
- generate draft flow
- bulk generate flow
- ignore and restore flow
- workspace replace confirmation flow if settings entry points remain linked from shell
- account-mode assign and merge flow

Manual:

- verify operator can work with lead list, preview, and draft area on one screen at common desktop widths
- verify queue remains usable with long names, long companies, and empty states
- verify account mode does not collapse the center workspace into unusable cards

### Exit Gate

Phase 3 must not start until Inbox is clearly usable as the main daily operating surface.

## Phase 3

Status: `[ ] Not started`

### Goal

Redesign Drafts into a compact review workspace aligned with the new Inbox interaction model.

### Scope

- redesign drafts list and filters
- redesign draft preview and editing surface
- align draft actions with the new shell and panel system
- improve readability of approval and send readiness states

### Primary UX Outcomes

- draft review feels like a focused operator workflow, not a secondary page
- approved, pending, sent, and failed states are easy to scan
- editing and approval actions are visible without oversized controls

### Likely Files To Update

- `apps/web/app/(crm)/drafts/page.tsx`
- `apps/web/components/crm/drafts/draft-actions.tsx`
- draft page components introduced in earlier redesign phases
- `apps/web/app/globals.css`

### Implementation Checklist

- [ ] redesign draft list density and grouping
- [ ] redesign draft preview/editor surface
- [ ] align action hierarchy for edit, approve, send, and open thread
- [ ] surface linked person/account/campaign context in a compact side panel
- [ ] preserve existing send approval rules and queue-send behavior

### Acceptance Criteria

- draft list is denser and easier to scan
- draft preview is readable without excessive whitespace
- approval and send actions are clear but not visually dominant
- operator can move from draft review to linked thread context efficiently

### Tests And Validation

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

### Exit Gate

Phase 4 must not start until Drafts matches the density and interaction model of the redesigned Inbox.

## Phase 4

Status: `[ ] Not started`

### Goal

Redesign Accounts so account mode becomes a practical ABM workspace rather than a secondary view.

### Scope

- redesign account list and account detail layout
- improve stakeholder map readability
- improve account merge and assignment ergonomics
- align account detail panels with the new shell and context model

### Primary UX Outcomes

- account mode is usable for stakeholder review and account-level planning
- merge and assignment actions are easier to understand and execute
- account detail view feels consistent with Inbox and Drafts

### Likely Files To Update

- account pages and account components introduced in prior phases
- `apps/web/components/crm/inbox/inbox-workspace.tsx` for account-mode presentation if still shared
- `apps/web/app/globals.css`

### Implementation Checklist

- [ ] redesign account list density and hierarchy
- [ ] redesign stakeholder lanes for compact readability
- [ ] redesign account action area for assign and merge flows
- [ ] align account detail metadata with right-panel conventions
- [ ] preserve account assignment and merge behavior

### Acceptance Criteria

- account list is scannable and compact
- stakeholder map is readable without oversized cards
- assign and merge actions are discoverable and usable
- account detail layout supports ABM workflows without visual clutter

### Tests And Validation

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

### Exit Gate

Phase 5 must not start until Accounts is visually and operationally aligned with the redesigned Inbox.

## Phase 5

Status: `[ ] Not started`

### Goal

Normalize the visual system across all CRM surfaces so the product feels coherent and intentionally designed.

### Scope

- unify typography scale
- unify spacing scale
- unify panel, border, and shadow rules
- unify button, tab, filter, and form control styles
- unify empty, loading, and inline feedback states

### Primary UX Outcomes

- the product feels like one system instead of route-specific styling experiments
- controls behave consistently across Inbox, Drafts, Accounts, Campaigns, LinkedIn, and Settings
- visual density is stable across the app

### Likely Files To Update

- `apps/web/app/globals.css`
- shared shell components
- shared modal components
- shared badges, chips, and form controls
- route-specific components that still use legacy styling

### Implementation Checklist

- [ ] define and apply shared typography tokens
- [ ] define and apply shared spacing tokens
- [ ] normalize panel and control styling
- [ ] normalize inline messages, badges, and status chips
- [ ] remove remaining legacy decorative styles from CRM routes

### Acceptance Criteria

- typography is consistent across all major routes
- controls and panels share the same visual language
- no major CRM route still looks like the old editorial shell
- density remains readable and stable across surfaces

### Tests And Validation

Automated:

- `pnpm --filter @mycrm/web typecheck`
- component tests for shared controls if behavior changes

E2E:

- smoke navigation across all major routes
- settings save/export flow
- send queue flow
- ignore/restore flow

Manual:

- verify visual consistency across Inbox, Drafts, Accounts, Campaigns, LinkedIn, and Settings
- verify compact controls remain accessible and readable
- verify status colors and badges remain distinguishable

### Exit Gate

Phase 6 must not start until the visual system is coherent across the product.

## Phase 6

Status: `[ ] Not started`

### Goal

Harden responsive behavior, collapse behavior, and all non-happy-path UI states introduced by the redesign.

### Scope

- stabilize shell collapse behavior
- stabilize overflow and truncation rules
- stabilize empty, loading, and error states in redesigned layouts
- ensure common laptop widths remain usable
- ensure modals and side panels still work with denser layouts

### Primary UX Outcomes

- redesigned layouts remain usable on common desktop and laptop widths
- collapse behavior does not create broken or hidden controls
- empty and error states still feel intentional and readable

### Likely Files To Update

- `apps/web/app/globals.css`
- shell components
- inbox, drafts, and accounts components
- modal components affected by spacing or overflow changes

### Implementation Checklist

- [ ] test and fix widths around 1280px, 1440px, and narrower laptop layouts
- [ ] fix truncation and overflow in dense lists and headers
- [ ] fix empty states for queue, drafts, accounts, and settings panels
- [ ] fix loading and error states for redesigned panels
- [ ] verify modal layering and focus behavior with collapsed shell

### Acceptance Criteria

- no major layout breaks at common desktop widths
- collapse behavior remains stable across routes
- empty and error states remain readable and actionable
- dense layouts do not clip critical actions or metadata

### Tests And Validation

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

### Exit Gate

Phase 7 must not start until redesigned layouts are stable under realistic desktop conditions.

## Phase 7

Status: `[ ] Not started`

### Goal

Run final regression, performance, and release-readiness validation for the Intercom-style redesign.

### Scope

- full regression pass on critical workflows
- performance sanity check after layout refactors
- final documentation updates
- release checklist for redesigned UI

### Primary UX Outcomes

- redesigned product is ready for daily use
- no critical workflow regression remains open
- documentation reflects the new shell and workspace model

### Implementation Checklist

- [ ] run full web typecheck
- [ ] run targeted unit and component tests for changed surfaces
- [ ] run full critical E2E regression set
- [ ] update docs and screenshots if maintained in repo
- [ ] write final redesign completion report

### Acceptance Criteria

- critical workflows pass validation
- redesigned shell and workspaces are documented
- no known blocker remains for daily operator use

### Tests And Validation

Automated:

- `pnpm --filter @mycrm/web typecheck`
- `pnpm --filter @mycrm/db typecheck`
- relevant web tests for changed components and services
- full critical Playwright regression set for CRM shell

Critical E2E set:

- inbox smoke flow
- settings save and export flow
- generate draft flow
- bulk generate flow
- queue send flow
- ignore and restore flow
- account assign flow
- account merge flow
- workspace replace confirmation flow

Manual:

- verify redesigned shell on common desktop widths
- verify operator can work continuously from queue to preview to draft to send without layout friction
- verify settings and destructive actions remain clear in the denser UI

### Exit Gate

The redesign program is complete only when the critical regression set is green and the redesigned shell is documented as the new default UX direction.

## Cross-Phase Regression Matrix

These workflows must be protected throughout the redesign program.

### Tier 1: Must Never Regress

- route navigation
- inbox load and selection
- conversation preview
- draft generation
- bulk draft generation
- queue send
- settings save
- backup export
- workspace restore confirmation guard
- ignore forever
- restore ignored person
- assign contact to account
- merge accounts

### Tier 2: Must Be Rechecked After Layout Refactors

- reminder modal flow
- sync queueing flow
- account-mode selection
- empty states
- error states
- long-name and long-text truncation

## Recommended Validation Strategy By Phase

Use the smallest reliable validation set during implementation, then expand before phase close.

### During Active Development

- affected package typecheck
- targeted component tests
- targeted route or service tests
- one focused E2E flow for the changed surface

### Before Closing Each Phase

- web typecheck
- all targeted tests for changed surfaces
- all relevant E2E flows listed in the phase

### Before Closing The Full Program

- full critical E2E regression set
- final manual desktop UX pass

## Risks And Mitigations

### Risk 1: Visual redesign breaks tested workflows

Mitigation:

- preserve existing APIs and mutation paths
- keep E2E coverage active after each major layout phase
- avoid mixing business-rule changes into visual phases unless necessary

### Risk 2: Density improvements reduce readability

Mitigation:

- reduce size gradually and validate with real seeded data
- prefer hierarchy through weight and spacing, not through oversized type
- test long names, long companies, and long draft content explicitly

### Risk 3: Collapsible shell introduces hidden-state bugs

Mitigation:

- keep collapse state simple and route-agnostic
- test collapse behavior across all major routes
- verify modal and focus behavior with both shell states

### Risk 4: Inbox redesign regresses account mode

Mitigation:

- treat account mode as a first-class validation target in Phase 2 and Phase 4
- keep account assign and merge flows in the regression matrix

### Risk 5: Styling divergence returns over time

Mitigation:

- centralize tokens and shared control styles in Phase 5
- remove legacy styling instead of layering new styles on top of old ones

## Definition Of Done For The Program

The Intercom-style redesign program is complete only when all of the following are true:

- the shell is compact and collapsible
- Inbox is a dense three-column operator workspace
- Drafts and Accounts are visually aligned with the new shell
- typography and spacing are normalized across the product
- critical workflows remain validated
- common desktop widths are stable
- the redesigned UX is documented as the new default direction

## Suggested Companion Documents

This master plan should be used together with:

- `docs/redesign-phase-execution-playbook.md`
- `docs/test-plan.md`
- existing phase-specific redesign files in `docs/redesign-phases/`

If implementation starts, each completed phase should also produce:

- a short phase report
- updated screenshots if the repo maintains them
- focused commits per phase