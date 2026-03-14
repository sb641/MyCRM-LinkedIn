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
- Phase 11: completed with settings UI/API, explicit secret reset controls, local secret storage, workspace-scoped backup export/restore semantics, redaction, import/reset hardening, secret-preservation coverage, and restore review safeguards
- Phase 12: not started yet

## Important constraints

- Real Playwright browser execution is still intentionally stubbed for both sync and send
- `ENABLE_REAL_BROWSER_SYNC` and `ENABLE_REAL_SEND` only unlock guarded seams; they do not provide full real-browser execution yet
- Keep work scoped to `MyCRM-LinkedIn` only
- Continue phases sequentially from `docs/implementation-plan.md`

## Recommended next work

Start Phase 12 from the current baseline:

1. Add regression E2E coverage for the main CRM, sync, send, and settings flows
2. Add error boundaries and broader hardening for daily local use
3. Finalize README/runbook and local release instructions
4. Prepare the release checklist and human review gate

## Key docs

- Main plan: `docs/implementation-plan.md`
- Architecture: `docs/architecture.md`
- Test plan: `docs/test-plan.md`
- Project overview: `README.md`
