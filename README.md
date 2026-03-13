# MyCRM-LinkedIn

This repository is being rebuilt into a local-first LinkedIn conversation CRM MVP.

## Current status

Phase 8 is the current baseline:

- pnpm monorepo
- Next.js CRM workspace shell
- worker skeleton
- shared TypeScript packages
- env validation with Zod
- structured logging with Pino
- feature flags for AI and automation
- mock adapters as the default integration path
- SQLite schema, migrations, and deterministic seed data
- repository, service, and API layers for inbox reads and CRM write mutations
- route-driven desktop shell with empty and error states
- CRM presentation layer with derived badges, timestamps, quick actions, and inbox sorting
- conversation history and draft history panels for the selected contact
- mock-backed AI draft generation with persisted variants and in-shell preview
- rule-based follow-up recommendations with due labels and urgency callouts in the shell
- queue-backed worker flow with job status API, lock recovery, retry scheduling, and per-job audit history
- automation adapter baseline with fake provider, DOM fixture parsing, session abstraction, guarded Playwright skeleton, mock `import_threads` worker processing, and visible sync run summaries in the CRM shell

The legacy Python automation files remain in the repository for reference during migration, but the new implementation path is TypeScript-first.

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

## Current acceptance checklist

- monorepo boots with pnpm
- web app exposes `/api/health`
- worker starts locally
- feature flags are visible in the app shell
- inbox and contact detail routes return seeded CRM data
- CRM workspace shell renders from live service data
- CRM shell derives attention priority, relationship signals, and quick actions from seeded data
- draft generation API persists generated variants into SQLite-backed draft records
- follow-up timing and next-step guidance are derived from CRM activity in the presentation layer
- queued jobs can be listed through the local jobs API and processed by the worker runtime
- queued jobs returned by the local jobs API include audit entries for enqueue, claim, retry, failure, and success transitions
- the automation package can parse deterministic thread fixtures and expose fake thread/message data without a real browser session
- lint, typecheck, tests, and build pass
- the real send method remains an explicit product decision to be discussed with the user before Phase 10 implementation

## Phase 1 database workflow

```bash
pnpm db:migrate
pnpm db:seed
pnpm test:integration
```

Schema, migrations, and progress tracking live in `packages/db` and `docs/implementation-plan.md`.

## Phase 5 workspace flow

- `/` loads the CRM workspace shell
- the server page loads inbox items and resolves the selected conversation from query params
- `contactId` and `conversationId` drive selection state
- `sort` preserves inbox ordering in the URL
- the shell derives CRM badges, timestamps, and next-step actions in a presentation layer
- the main workspace renders contact summary, conversation history, and draft history from live service data
- the draft panel can request mock Gemini variants from the current conversation context
- generated variants are persisted into the existing draft tables and previewed in the shell before approval
- the shell supports ready, empty, and error states for later AI and automation expansion

## Phase 6 follow-up flow

- the contact summary derives follow-up timing from the latest reply/sent/interaction timestamps
- the shell shows a follow-up label and urgency callout when outreach is due or overdue
- quick actions now prioritize follow-up work before deeper automation is introduced in later phases

## Phase 7 jobs and worker flow

- the worker runs as a separate local Node process via `pnpm dev:worker`
- queued jobs are stored in SQLite and exposed through `/api/jobs`
- the current worker slice claims the next queued job, recovers stale locks, reschedules retryable failures before terminal failure, and records each lifecycle transition in `audit_log`
- `/api/jobs` now returns each job together with its audit trail for local observability
- this queue path is validated with both db-level persistence coverage and worker integration tests

## Phase 8 automation adapter flow

- `packages/automation` now defines the messaging provider contract for thread listing and message loading
- the fake provider is backed by deterministic DOM fixtures so automation behavior can be tested locally without LinkedIn access
- deterministic mock import helpers now let the worker simulate thread sync jobs without a real browser session
- a session store abstraction is in place for later browser-backed providers
- the Playwright provider is present only as a guarded skeleton and is intentionally not active yet
- `import_threads` jobs can now be processed by the worker and recorded into `sync_runs` for local observability
- recent sync runs are now exposed through the local jobs service/API path and rendered in the shell

## Legacy code

The previous Python implementation is still present in the root for migration reference. It is not part of the new Phase 0 runtime.
