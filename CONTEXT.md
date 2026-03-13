# MyCRM-LinkedIn Context

This file is the short restart point for a new chat.

## Project

- Local-first LinkedIn conversation CRM MVP
- TypeScript monorepo
- Main runtime surfaces: `apps/web` and `apps/worker`
- Shared packages: `packages/core`, `packages/db`, `packages/ai`, `packages/automation`, `packages/test-fixtures`

## Current phase status

- Phase 0 to Phase 10: completed in code
- Phase 9: completed with persistent browser-session bootstrap, guarded browser sync entry path, shell readiness state, and operator-facing sync guidance
- Phase 10: completed with queue-send API/UI, worker `send_message` handling, send audit trail, queue dedupe, duplicate-send safety guard, and fake-provider validation
- Next phase: Phase 11

## Important constraints

- Real Playwright browser execution is still intentionally stubbed for both sync and send
- `ENABLE_REAL_BROWSER_SYNC` and `ENABLE_REAL_SEND` only unlock guarded seams; they do not provide full real-browser execution yet
- Keep work scoped to `MyCRM-LinkedIn` only
- Continue phases sequentially from `docs/implementation-plan.md`

## Recommended next work

Start Phase 11:

1. Settings UI
2. Secret storage
3. Backup/export and restore/import
4. Log redaction
5. Tests and docs update

## Key docs

- Main plan: `docs/implementation-plan.md`
- Architecture: `docs/architecture.md`
- Test plan: `docs/test-plan.md`
- Project overview: `README.md`
