# Phase 02 Plan: Inbox Layout Overhaul

Status: not started

## Goal
Rebuild Inbox into a dense three-column operator workspace optimized for lead lists, preview, and drafts.

## Why This Phase Exists
Inbox is the main daily operating surface. If it remains card-heavy and visually loose, the product will still feel like a dashboard instead of an operator console even if the shell is already fixed.

## In Scope
- redesign queue and list column
- redesign center conversation workspace
- redesign right context panel
- reduce oversized cards and whitespace
- keep preview and draft work visible without constant scrolling or context loss
- preserve account mode inside the new layout

## Out Of Scope
- dedicated Drafts page redesign
- full Accounts workspace redesign
- app-wide typography normalization beyond what Inbox needs locally
- responsive hardening beyond the main desktop target

## Target UX Outcome
- operator can scan many leads quickly
- operator can keep thread context visible while drafting
- operator can access person and account context without leaving the thread
- queue, preview, and context feel like one integrated workspace

## Target Layout
Left column:
- queue tabs
- people and accounts toggle
- filters
- sort controls
- dense lead list

Center column:
- conversation header
- message timeline or account preview
- draft composer
- draft variants and actions

Right column:
- person details
- account details
- campaign context
- reminders and operational metadata

## Likely Files To Touch
- `apps/web/components/crm/inbox/inbox-workspace.tsx`
- `apps/web/lib/view-models/inbox.ts`
- inbox-related subcomponents extracted during refactor
- `apps/web/app/(crm)/inbox/page.tsx`
- `apps/web/app/globals.css`

## Implementation Checklist
- [ ] convert inbox from large-card composition to dense panel composition
- [ ] reduce queue row height and tighten metadata layout
- [ ] keep selected thread visible and visually anchored
- [ ] keep draft composer visible in the main working area
- [ ] keep context panel persistent on desktop
- [ ] ensure account mode still works inside the new layout
- [ ] preserve ignore, reminder, generate, bulk-generate, send, and sync actions
- [ ] verify long names, long companies, and empty states in dense rows

## Acceptance Criteria
- queue list supports fast scanning with smaller typography and tighter rows
- selected conversation or account is visually obvious
- draft generation and review remain in the main working surface
- right context panel remains useful and readable without overwhelming the screen
- no critical inbox action is lost during redesign

## Validation
Automated:
- `pnpm --filter @mycrm/web typecheck`
- inbox component tests for selection, queue rendering, and action visibility
- inbox view-model tests if layout refactor changes derived state usage

E2E:
- smoke flow for `/inbox`
- generate draft flow
- bulk generate flow
- ignore and restore flow
- account-mode assign and merge flow if still entered through Inbox

Manual:
- verify operator can work with lead list, preview, and draft area on one screen at common desktop widths
- verify queue remains usable with long names, long companies, and empty states
- verify account mode does not collapse the center workspace into unusable cards

## Exit Gate
Phase 03 must not start until Inbox is clearly usable as the main daily operating surface.

## Dependencies For Later Phases
- depends on Phase 01 shell stability
- provides the interaction model that Phase 03 and Phase 04 should align with