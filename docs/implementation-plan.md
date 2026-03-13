# Implementation Plan

This file tracks the phased rebuild of the local-first LinkedIn conversation CRM MVP.

## Execution Rules

- Implement phases sequentially.
- Do not start the next phase until the current phase passes tests.
- Keep AI and automation behind feature flags.
- Keep all external integrations behind mock adapters.
- Do not rely on real provider automation in CI.
- Keep sending explicit and user-triggered.
- Update this file as each phase progresses.

## Status Legend

- `[x]` completed
- `[-]` in progress
- `[ ]` not started
- `[!]` blocked or needs review

## Phase Overview

| Status | Phase | Name | Notes |
|---|---:|---|---|
| [x] | 0 | Project Bootstrap and Engineering Guardrails | Completed and validated with lint, typecheck, tests, build |
| [x] | 1 | Domain Model and SQLite Schema | Completed and validated with typecheck and integration tests |
| [x] | 2 | Core Repositories and Service Layer | Completed and validated |
| [x] | 3 | UI Shell and Navigation | Completed and validated |
| [x] | 4 | Contact List, Conversation Viewer, and CRM Status Engine | Completed and validated |
| [x] | 5 | Draft Workflow and Gemini Integration | Completed and validated |
| [x] | 6 | Follow-up Recommendation Engine | Completed and validated |
| [x] | 7 | Jobs, Worker, and Queueing | Completed and validated |
| [x] | 8 | Automation Adapter with Fixtures and Fake Provider | Completed and validated with fake provider, mock import worker flow, and sync run observability |
| [x] | 9 | Real Browser-Assisted Sync | Completed in code, tests, and docs; real Playwright execution remains intentionally stubbed |
| [x] | 10 | User-Approved Send Workflow | Completed in code, tests, and docs with guarded browser-send seam and fake-provider validation |
| [ ] | 11 | Settings, Secrets, Security, Backup/Restore | Next phase |
| [ ] | 12 | Hardening, Performance, QA, and Release | Pending |

## Phase 0

Status: `[x] Completed`

Goal:
Create a stable base so the app can be built safely without rework.

Deliverables:
- monorepo structure
- TypeScript config
- ESLint + Prettier
- test runners
- env validation
- CI pipeline
- health page / app shell

Acceptance checklist:
- [x] Initialize monorepo with `pnpm`
- [x] Create `apps` and `packages` structure
- [x] Add shared TypeScript configuration
- [x] Add shared linting and formatting config
- [x] Add env schema validation using `zod`
- [x] Add structured logger
- [x] Create base Next.js app shell
- [x] Add worker process skeleton
- [x] Add CI workflow
- [x] `pnpm lint` passes
- [x] `pnpm typecheck` passes
- [x] `pnpm test` passes
- [x] `pnpm build` passes

## Phase 1

Status: `[x] Completed`

Goal:
Define a clean data model that separates CRM state, draft state, and send state.

Deliverables:
- `contacts`
- `conversations`
- `messages`
- `drafts`
- `draft_variants`
- `jobs`
- `sync_runs`
- `settings`
- `audit_log`

Implementation checklist:
- [x] Choose and implement ORM: Drizzle or Prisma
- [x] Add SQLite schema package structure
- [x] Add migrations
- [x] Add indexes for contacts, conversations, messages, jobs
- [x] Add seed data for contacts, conversations, messages, drafts
- [x] Add enum/constants in `packages/core`
- [x] Add schema tests
- [x] Update docs for schema and seed usage

Review gate:
- [x] Human review before Phase 2

## Phase 2

Status: `[x] Complete`

Goal:
Create repositories, services, DTOs, validation, and initial API routes.

Implementation checklist:
- [x] Repository CRUD helpers
- [x] Service layer with validation
- [x] DTOs and Zod schemas
- [x] Error model
- [x] Transaction helpers
- [x] Initial API routes
- [x] Unit and integration tests
- [x] Docs update

Validation:
- [x] `pnpm --filter @mycrm/web test`
- [x] `pnpm test`
- [x] `pnpm typecheck`

## Phase 3

Status: `[x] Complete`

Goal:
Build the working desktop layout and state flow.

Implementation checklist:
- [x] App shell and navigation
- [x] Top bar actions
- [x] Route/state model
- [x] Empty/loading/error states
- [x] UI tests and E2E smoke
- [x] Docs update

Validation:
- [x] `pnpm --filter @mycrm/web test`
- [x] `pnpm test`
- [x] `pnpm typecheck`

## Phase 4

Status: `[x] Complete`

Goal:
Make the CRM useful before AI.

Implementation checklist:
- [x] Contact list and conversation history
- [x] CRM badges and timestamps
- [x] Relationship status derivation rules
- [x] Sorting and quick actions
- [x] Unit/integration/component tests
- [x] Docs update

Validation:
- [x] `pnpm --filter @mycrm/web test`
- [x] `pnpm test`
- [x] `pnpm typecheck`

## Phase 5

Status: `[x] Complete`

Goal:
Implement AI draft generation, review, approval, and storage.

Implementation checklist:
- [x] Gemini adapter contract and implementation
- [x] Prompt builder
- [x] Draft validators
- [x] Draft generation API
- [x] Variants persistence
- [x] Draft approval/edit/copy UI
- [x] Mocked AI tests
- [x] Docs update

Review gate:
- [x] Human review before Phase 6

Validation:
- [x] `pnpm --filter @mycrm/web test`
- [x] `pnpm test`
- [x] `pnpm typecheck`

## Phase 6

Status: `[x] Complete`

Goal:
Add rule-based follow-up recommendations.

Implementation checklist:
- [x] Follow-up rules engine
- [x] `followup_due_at` support
- [x] UI reminders and CTA
- [x] Tests and docs update

Validation:
- [x] `pnpm --filter @mycrm/web test`
- [x] `pnpm test`
- [x] `pnpm typecheck`

## Phase 7

Status: `[x] Complete`

Goal:
Move long-running tasks into the worker and queue.

Implementation checklist:
- [x] Job types and transitions
- [x] Locking and retry policy
- [x] Audit logging for jobs
- [x] Polling endpoint/UI
- [x] Worker integration tests
- [x] Docs update

Validation:
- [x] `pnpm --filter @mycrm/db test`
- [x] `pnpm --filter @mycrm/web test`
- [x] `pnpm --filter @mycrm/worker test`
- [x] `pnpm test`
- [x] `pnpm typecheck`

## Phase 8

Status: `[x] Complete`

Goal:
Build a testable automation layer with fixtures and fake provider.

Implementation checklist:
- [x] Messaging provider interface
- [x] Fake provider
- [x] Playwright provider skeleton
- [x] DOM fixtures and parsers
- [x] Session storage abstraction
- [x] Mock import summary helpers
- [x] Worker processing for `import_threads` jobs
- [x] `sync_runs` persistence for fake import flows
- [x] `sync_runs` read-side service and API exposure
- [x] Sync run visibility in the CRM shell
- [x] Integration and E2E tests
- [x] Docs update

Validation:
- [x] `pnpm --filter @mycrm/automation test`
- [x] `pnpm --filter @mycrm/automation typecheck`
- [x] `pnpm --filter @mycrm/db test`
- [x] `pnpm --filter @mycrm/worker test`
- [x] `pnpm test`
- [x] `pnpm typecheck`

Review gate:
- [x] Human review before Phase 9

## Phase 9

Status: `[x] Completed`

Goal:
Add a guarded real browser-assisted sync path without breaking the local-first fake-provider workflow.

Implementation checklist:
- [x] Guarded real-browser sync entry path with fake fallback
- [x] Manual browser sync enqueue API and shell action
- [x] Active sync job state tracking and error visibility in the CRM shell
- [x] Session-backed browser auth/bootstrap flow
- [x] Browser sync result reconciliation and richer operator UX
- [x] Session bootstrap/save API and persistent session store
- [x] Browser session readiness and richer operator sync status in the CRM shell
- [x] Error handling
- [x] Mock/integration tests and manual smoke notes
- [x] Docs update for completed Phase 9 scope

Validation:
- [x] `pnpm --filter @mycrm/automation test`
- [x] `pnpm --filter @mycrm/worker test -- --run src/index.test.ts`
- [x] `pnpm --filter @mycrm/web test -- --run app/api/browser-session/route.test.ts app/api/jobs/route.test.ts`
- [x] `pnpm --filter @mycrm/web test -- --run app/page.test.tsx lib/crm-shell.test.ts app/api/browser-session/route.test.ts app/api/jobs/route.test.ts`
- [x] `pnpm --filter @mycrm/web test -- --run lib/crm-shell.test.ts app/page.test.tsx`

## Phase 10

Status: `[x] Completed`

Goal:
Allow explicit user-approved sending through the provider.

Decision gate:
- [x] Discussed send-path options with the user before implementation.
- [x] User selected the browser-driven send path.

Implementation checklist:
- [x] Send eligibility rules
- [x] Queue send job
- [x] Worker send execution
- [x] Success/failure state handling
- [x] Audit trail
- [x] Fake provider E2E
- [x] Queue-send UI and API route
- [x] Duplicate queue dedupe by `draftId`
- [x] Duplicate-send safety guard for already-sent drafts
- [x] Docs update

Validation:
- [x] `pnpm --filter @mycrm/automation test`
- [x] `pnpm --filter @mycrm/worker test -- --run src/index.test.ts`
- [x] `pnpm --filter @mycrm/web test -- --run lib/services/crm-service.test.ts`
- [x] `pnpm --filter @mycrm/web test -- --run app/api/drafts/[draftId]/send/route.test.ts app/page.test.tsx`
- [x] `pnpm --filter @mycrm/web test -- --run lib/services/crm-service.test.ts app/api/drafts/[draftId]/send/route.test.ts app/page.test.tsx`

Review gate:
- [ ] Human review before Phase 11

## Phase 11

Status: `[ ] Not started`

Goal:
Make the app safe and operable locally.

Implementation checklist:
- [ ] Settings UI
- [ ] Secret storage
- [ ] Backup/export
- [ ] Restore/import
- [ ] Log redaction
- [ ] Tests and docs update

## Phase 12

Status: `[ ] Not started`

Goal:
Harden the MVP for daily use.

Implementation checklist:
- [ ] Regression E2E flows
- [ ] Performance validation
- [ ] Error boundaries
- [ ] Final README and runbook
- [ ] Docker/local run instructions
- [ ] Release checklist

Review gate:
- [ ] Human review before release

## Progress Log

### 2026-03-13
- Phase 10 send path completed after the user selected browser-driven sending as the preferred operator flow.
- Added shared send DTOs, queue-send service wiring, worker `send_message` handling, and guarded browser-send automation seam.
- Added CRM shell `Queue send` action and dedicated `/api/drafts/[draftId]/send` route with focused route/page coverage.
- Added worker duplicate-send safety coverage and stabilized worker fixtures so send tests run against deterministic seeded domain data.
- Added `send_message` enqueue deduplication for the same approved draft across `queued`, `running`, and `retry_scheduled` jobs.
- Added draft-level send audit events and a fake-provider send path that can complete the full queue -> worker -> mutation flow without Playwright.
- Validation passed: `pnpm --filter @mycrm/automation test`, `pnpm --filter @mycrm/worker test -- --run src/index.test.ts`, and `pnpm --filter @mycrm/web test -- --run lib/services/crm-service.test.ts app/api/drafts/[draftId]/send/route.test.ts app/page.test.tsx`.
- Phase 9 completed.
- Added a persistent file-backed browser session store in `packages/automation` so the web app and worker share the same saved session source.
- Added `/api/browser-session` in `apps/web` for saving and reading session bootstrap payloads by account ID.
- Updated the worker to use the persistent session store for guarded real-browser sync attempts instead of an ephemeral in-memory store.
- The CRM shell now surfaces saved browser-session readiness, browser agent metadata, richer sync-run summaries, and normalized operator guidance for missing or stale sessions.
- Added worker coverage for the saved-session real-browser path so Phase 9 verifies both the missing-session guard and the persisted-session handoff into the not-yet-implemented browser provider.
- Added manual smoke notes for saving a browser session, queueing manual sync, and verifying operator-facing retry guidance while real browser execution remains intentionally stubbed.
- Validation passed: `pnpm --filter @mycrm/automation test`, `pnpm --filter @mycrm/worker test -- --run src/index.test.ts`, and `pnpm --filter @mycrm/web test -- --run app/page.test.tsx lib/crm-shell.test.ts app/api/browser-session/route.test.ts app/api/jobs/route.test.ts`.
