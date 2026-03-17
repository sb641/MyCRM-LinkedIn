---
name: review
description: "Use when: code review, bug hunting, regression analysis, race conditions, trust-boundary issues, missing tests, production risk review."
---

# Review

Use this skill when the user wants a serious code review focused on what can still break.

## Workflow

1. Look for correctness and production-risk issues first.
2. Prioritize race conditions, stale state, trust-boundary mistakes, and broken invariants.
3. Check whether tests miss the real failure mode.
4. Report findings ordered by severity.
5. Keep summary brief and secondary.

## Output Shape

- Findings first
- Open questions or assumptions
- Brief risk summary

## Rules

- Do not pad with style nits.
- Prefer a few strong findings over many weak ones.
- Tie every concern to a plausible failure mode.
- If there are no findings, say so explicitly and mention residual risks.