# Intercom-Style Redesign Phase Plans

This directory contains the execution-ready phase plans for the Intercom-style redesign program.

Source of truth:
- `docs/intercom-style-redesign-master-plan.md`

Purpose of this directory:
- keep the redesign program split into small phase documents
- avoid loading the full master plan into agent context for every task
- let implementation work focus on one phase at a time
- preserve the master plan as the project-level contract

How to use these documents:
1. Start from the master plan for overall direction and constraints.
2. Load only the relevant phase file into working context before implementation.
3. Use the phase file as the execution contract for the current task.
4. Validate only the changed surface during active work, then run the broader phase validation before closing the phase.
5. Update the master plan and any phase report when a phase is completed.

Program phases:
- `phase-00-ux-baseline-and-guardrails.md`
- `phase-01-shell-and-collapsible-nav.md`
- `phase-02-inbox-layout-overhaul.md`
- `phase-03-draft-workspace-redesign.md`
- `phase-04-accounts-workspace-redesign.md`
- `phase-05-shared-visual-system-and-density.md`
- `phase-06-responsive-and-edge-state-hardening.md`
- `phase-07-regression-performance-release.md`

Recommended context-loading rule:
- planning a phase: load the master plan plus one phase file
- implementing a phase: load one phase file plus only the directly relevant code files
- reviewing progress: load the master plan, the phase file, and the changed files only

Relationship to the older redesign roadmap:
- `docs/redesign-phases/` contains the earlier CRM rebuild roadmap and legacy phase plans.
- `docs/intercom-redesign-phases/` contains the newer Intercom-style operator-console redesign track.
- The two tracks should not be mixed in the same implementation context unless a task explicitly requires cross-reference.