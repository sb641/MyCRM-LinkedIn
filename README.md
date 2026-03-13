# MyCRM-LinkedIn

Local-first LinkedIn conversation CRM MVP built as a TypeScript monorepo.

## Current status

Current baseline: Phase 10 completed in code, tests, and docs.

Implemented so far:

- pnpm monorepo with shared TypeScript packages
- Next.js CRM workspace shell and local worker runtime
- env validation, structured logging, and feature flags
- SQLite schema, migrations, deterministic seed data, and repository/service layers
- inbox, conversation, CRM status, and draft history workspace
- mock-backed Gemini draft generation and approval flow
- rule-based follow-up recommendations
- queue-backed worker flow with audit history and retry scheduling
- automation adapter with fake provider, DOM fixture parsing, and guarded Playwright skeleton
- guarded real browser sync entry path with persistent browser-session bootstrap
- browser-session readiness, sync-run summaries, and operator-facing sync guidance in the shell
- user-approved send workflow with queue-send API/UI, worker `send_message` handling, audit trail, and fake-provider validation

Not implemented yet:

- real Playwright browser execution for sync and send remains intentionally stubbed
- Phase 11 settings, secrets, backup/restore, and security hardening
- Phase 12 release hardening and runbook work

Primary progress tracker: `docs/implementation-plan.md`

## Workspace layout

```txt
apps/
  web/
  worker/
packages/
  ai/
  automation/
  core/
  db/
  test-fixtures/
docs/
```

## Feature flags

Copy `.env.example` to `.env` and configure:

```env
NODE_ENV=development
DATABASE_URL=file:./local.db
GEMINI_API_KEY=
ENABLE_AI=false
ENABLE_AUTOMATION=false
ENABLE_REAL_BROWSER_SYNC=false
ENABLE_REAL_SEND=false
LOG_LEVEL=info
```

Notes:

- `ENABLE_REAL_BROWSER_SYNC=true` unlocks the guarded browser-session-backed sync path.
- `ENABLE_REAL_SEND=true` unlocks the guarded browser-send seam.
- Even with both flags enabled, real Playwright execution is still intentionally not implemented.

## Commands

```bash
pnpm install
pnpm dev:web
pnpm dev:worker
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Focused validation commands used for the latest phases:

```bash
pnpm --filter @mycrm/automation test
pnpm --filter @mycrm/worker test -- --run src/index.test.ts
pnpm --filter @mycrm/web test -- --run app/page.test.tsx lib/crm-shell.test.ts app/api/browser-session/route.test.ts app/api/jobs/route.test.ts
pnpm --filter @mycrm/web test -- --run lib/services/crm-service.test.ts app/api/drafts/[draftId]/send/route.test.ts app/page.test.tsx
```

## Current product flow

### CRM workspace

- `/` loads the CRM workspace shell.
- `contactId`, `conversationId`, and `sort` in the URL drive selection and inbox ordering.
- the shell renders contact summary, conversation history, draft history, follow-up guidance, and quick actions from live service data.

### Browser sync flow

- the shell can queue manual browser sync through `/api/jobs?mode=manual-sync`
- browser sessions can be saved and inspected through `/api/browser-session`
- the worker reads saved sessions from the shared file-backed session store
- when no saved session exists, the worker records a failed `sync_run` and schedules retry
- operator-facing sync guidance is normalized in the shell

### Send flow

- approved drafts can be queued through `/api/drafts/[draftId]/send`
- the shell exposes `Queue send` for approved drafts
- the worker processes `send_message` jobs through the automation send seam
- queue dedupe prevents multiple active `send_message` jobs for the same `draftId`
- already-sent drafts are guarded against duplicate-send retries
- fake-provider coverage validates the queue -> worker -> mutation path without Playwright

## Next phase

Next planned phase: Phase 11.

Scope:

- Settings UI
- Secret storage
- Backup/export
- Restore/import
- Log redaction
- Tests and docs update

## Legacy code

The previous Python implementation is still present in the root for migration reference. It is not part of the new TypeScript runtime.
