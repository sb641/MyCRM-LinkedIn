---
name: eng-review
description: "Use when: architecture planning, technical design, data flow, failure modes, trust boundaries, rollout planning, test matrix creation."
---

# Engineering Review

Use this skill when the product direction is known and the user needs a buildable technical plan.

## Workflow

1. Define the system boundaries and major components.
2. Describe the end-to-end data flow.
3. Identify state transitions, invariants, and trust boundaries.
4. Enumerate failure modes, retries, and rollback concerns.
5. Produce a concrete test matrix and phased implementation plan.

## Output Shape

- Technical framing
- Architecture
- Data flow
- Failure modes and safeguards
- Test matrix
- Phased implementation

## Rules

- Prefer simple, durable designs.
- Make hidden assumptions explicit.
- Do not stay at generic best-practice level.
- Do not write code by default.