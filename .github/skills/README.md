# Skills

Reusable Copilot skill packages for the MyCRM-LinkedIn workspace.

## Available Skills

- `/ceo-review` for product strategy, feature reframing, scope shaping, and founder-mode decisions.
- `/eng-review` for architecture planning, data flow, failure modes, trust boundaries, and test strategy.
- `/review` for bug-focused code review, regression hunting, and missing-test analysis.
- `/ship` for release readiness, landing sequence, rollout checks, and post-merge watchpoints.

## When To Use What

- Use `/ceo-review` when the main question is whether this is the right product move.
- Use `/eng-review` when the product direction is known and you need a buildable technical plan.
- Use `/review` when code exists and you want findings about correctness and production risk.
- Use `/ship` when the branch is close to done and you need the fastest safe path to merge.

## Notes

- These are workspace-local skills under `.github/skills`, so VS Code should discover them in this repository.
- Keep skill names unique to avoid duplicate slash entries.