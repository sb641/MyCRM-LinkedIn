# Redesign Plan Index

This directory now serves as the index for two different redesign planning tracks in the repository.

## 1. Legacy CRM Rebuild Track

Use this track when the task refers to the earlier functional CRM rebuild roadmap.

Source of truth:
- `docs/redesign-phase-execution-playbook.md`

Legacy phase documents in this directory:
- `phase-01-route-based-crm-shell.md`
- `phase-02-redesign-inbox-workspace.md`
- `phase-03-drafts-review-page.md`
- `phase-04-bulk-draft-generation.md`
- `phase-05-accounts-and-abm-grouping.md`
- `phase-06-reminders.md`
- `phase-07-campaigns.md`
- `phase-08-delete-and-ignore.md`
- `phase-09-tags-and-productivity.md`
- `phase-10-command-palette-and-shortcuts.md`

Use the legacy track when the task is about:
- the original CRM rebuild sequence
- schema and entity rollout from the older roadmap
- older phase numbering from the execution playbook
- implementation work already scoped to these legacy phase files

## 2. Intercom-Style Redesign Track

Use this track when the task refers to the newer operator-console redesign focused on density, layout, navigation behavior, and workflow ergonomics.

Source of truth:
- `docs/intercom-style-redesign-master-plan.md`

Execution-ready phase files for this track live in:
- `docs/intercom-redesign-phases/`

Intercom-style phase documents:
- `docs/intercom-redesign-phases/phase-00-ux-baseline-and-guardrails.md`
- `docs/intercom-redesign-phases/phase-01-shell-and-collapsible-nav.md`
- `docs/intercom-redesign-phases/phase-02-inbox-layout-overhaul.md`
- `docs/intercom-redesign-phases/phase-03-draft-workspace-redesign.md`
- `docs/intercom-redesign-phases/phase-04-accounts-workspace-redesign.md`
- `docs/intercom-redesign-phases/phase-05-shared-visual-system-and-density.md`
- `docs/intercom-redesign-phases/phase-06-responsive-and-edge-state-hardening.md`
- `docs/intercom-redesign-phases/phase-07-regression-performance-release.md`

Use the Intercom-style track when the task is about:
- compact shell behavior
- dense three-column inbox layout
- draft and account workspace ergonomics
- typography, spacing, and panel normalization
- responsive hardening of the redesigned operator console

## Context-Loading Rule

To avoid pulling the whole application structure into context:

1. Load only the source-of-truth master document for the active track.
2. Load only one phase file for the current task.
3. Add only the directly relevant code files after that.

Do not mix the legacy and Intercom-style phase tracks in the same implementation context unless the task explicitly requires cross-reference.
