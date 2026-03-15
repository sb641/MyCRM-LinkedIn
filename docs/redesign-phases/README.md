# Redesign Phase Plans

This directory splits the master redesign playbook into one execution-ready plan per phase.

Source of truth:
- `docs/redesign-phase-execution-playbook.md`

How to use these documents:
1. Mark the active phase as in progress in the working TODO list.
2. Re-read the relevant phase plan before coding.
3. Complete the full phase scope unless a hard blocker exists.
4. Run the required validation for the changed surface.
5. Post the phase report here in chat using the template in the phase document.
6. Create a focused git commit for the phase.

Mandatory execution rule for every phase:
- The phase must start with a TODO update.
- The phase must end with a report posted here in chat and a focused git commit.

Global constraints inherited by every phase:
- Single-user only.
- One LinkedIn account per workspace.
- Desktop-first UX.
- Manual approval required for every outgoing message.
- Reuse existing backend, APIs, worker, and tested flows wherever possible.
- No full rewrite.
- Preserve server-side read assembly and client-side mutation patterns.
- Keep future compatibility with Vercel plus Postgres-like deployment.
- Delete and Ignore must be soft-delete plus sync suppression plus restore.
- Campaigns are single-action outreach containers, not sequences.

Phase documents:
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
