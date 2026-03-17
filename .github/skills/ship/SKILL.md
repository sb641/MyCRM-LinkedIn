---
name: ship
description: "Use when: release readiness, merge readiness, final validation, landing sequence, rollout checks, deployment hygiene, post-merge watchpoints."
---

# Ship

Use this skill when the branch is close to done and the user needs disciplined final-mile execution.

## Workflow

1. Assess whether the branch is actually ready to land.
2. Identify missing validation, docs, migrations, or rollout checks.
3. Recommend the fastest safe landing sequence.
4. Call out post-merge watchpoints and rollback concerns.

## Output Shape

- Ship-readiness assessment
- Remaining blockers
- Landing sequence
- Post-merge watchpoints

## Rules

- Do not drift back into ideation.
- Do not assume green tests are enough.
- Prefer concrete execution steps.
- Say clearly if the branch is not ready.