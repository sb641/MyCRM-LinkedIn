# MyCRM-LinkedIn Context

This file is the short restart point for a new chat.

## Project

- Local-first LinkedIn conversation CRM MVP
- TypeScript monorepo
- Main runtime surfaces: `apps/web` and `apps/worker`
- Shared packages: `packages/core`, `packages/db`, `packages/ai`, `packages/automation`, `packages/test-fixtures`

## Current phase status

- Phase 0 to Phase 8: completed in code
- Phase 9: browser architecture exists, but real browser sync needs repair before it can be treated as production-ready; CDP-first provider selection, session reuse, and live validation are still pending
- Phase 10: approval and queue-send flow are implemented, but real browser send remains blocked on the repaired browser provider path
- Phase 11: completed with settings UI/API, explicit secret reset controls, local secret storage, workspace-scoped backup export/restore semantics, redaction, import/reset hardening, secret-preservation coverage, and restore review safeguards
- Phase 12: not started yet

## Important constraints

- Real browser execution is partially scaffolded but not yet production-ready for sync or send
- `ENABLE_REAL_BROWSER_SYNC` and `ENABLE_REAL_SEND` unlock guarded seams; they still require Phase 9 and Phase 10 browser-path repair before they should be treated as complete
- Keep work scoped to `MyCRM-LinkedIn` only
- Continue phases sequentially from `docs/implementation-plan.md`

## Recommended next work

Finish the browser work before starting Phase 12:

1. Repair provider selection and make CDP-first browser reuse the default real-browser path
2. Complete real browser send on top of the repaired provider path
3. Validate live sync/send against an already-open authenticated Chrome session
4. Then start Phase 12 hardening, regression coverage, and release readiness

## Key docs

- Main plan: `docs/implementation-plan.md`
- Architecture: `docs/architecture.md`
- Test plan: `docs/test-plan.md`
- Project overview: `README.md`
