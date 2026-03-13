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
| [-] | 7 | Jobs, Worker, and Queueing | First vertical slice completed and validated |
| [ ] | 8 | Automation Adapter with Fixtures and Fake Provider | Pending |
| [ ] | 9 | Real Browser-Assisted Sync | Pending |
| [ ] | 10 | User-Approved Send Workflow | Pending |
| [ ] | 11 | Settings, Secrets, Security, Backup/Restore | Pending |
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
- logging setup

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

Status: `[-] In progress`

Goal:
Move long-running tasks into the worker and queue.

Implementation checklist:
- [x] Job types and transitions
- [ ] Locking and retry policy
- [ ] Audit logging for jobs
- [x] Polling endpoint/UI
- [x] Worker integration tests
- [x] Docs update

Validation:
- [x] `pnpm --filter @mycrm/db test`
- [x] `pnpm --filter @mycrm/worker test`
- [x] `pnpm test`
- [x] `pnpm typecheck`

## Phase 8

Status: `[ ] Not started`

Goal:
Build a testable automation layer with fixtures and fake provider.

Implementation checklist:
- [ ] Messaging provider interface
- [ ] Fake provider
- [ ] Playwright provider skeleton
- [ ] DOM fixtures and parsers
- [ ] Session storage abstraction
- [ ] Integration and E2E tests
- [ ] Docs update

Review gate:
- [ ] Human review before Phase 9
- [ ] Discuss real send approach options with user before Phase 10 implementation

## Phase 9

Status: `[ ] Not started`

Goal:
Connect real browser-assisted sync for manual import.

Implementation checklist:
- [ ] Real browser sync feature flag
- [ ] Session loading
- [ ] Manual sync action
- [ ] Sync run tracking
- [ ] Error handling
- [ ] Mock/integration tests and manual smoke notes
- [ ] Docs update

## Phase 10

Status: `[ ] Not started`

Goal:
Allow explicit user-approved sending through the provider.

Decision gate:
- Before implementing real sending, prepare options for the user and agree on the send method.
- Candidate options must include at least browser UI automation via Playwright, browser-assisted manual send, and a hybrid provider approach.
- Do not hard-code the real send path until the user selects the preferred option.

Implementation checklist:
- [ ] Send eligibility rules
- [ ] Queue send job
- [ ] Worker send execution
- [ ] Success/failure state handling
- [ ] Audit trail
- [ ] Fake provider E2E
- [ ] Docs update

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

- Phase 0 completed.
- Monorepo bootstrap, web shell, worker skeleton, env validation, logger, CI, and smoke tests are in place.
- Phase 1 started.
- ORM decision: Drizzle + SQLite.
- Phase 1 completed.
- Added normalized CRM schema, migrations, deterministic seed data, and integration coverage for cascades, indexes, dedupe, and status separation.
- Switched the SQLite runtime path to `sql.js` because native `better-sqlite3` and `sqlite3` bindings were not available under the current local `Node v25` environment.
- Validation passed: `pnpm --filter @mycrm/db typecheck`, `pnpm --filter @mycrm/db test:integration`, and `pnpm test`.
- Phase 2 started.
- Added shared DTO schemas and application errors in `packages/core`.
- Added repository helpers and a transaction helper in `packages/db`.
- Added inbox/detail service layer and initial read API routes in `apps/web`.
- For Phase 2 read models, switched repository reads to direct SQL over the existing `sql.js` connection because the current Drizzle `sqlite-proxy` path was unreliable for these joined read queries.
- Validation passed: `pnpm --filter @mycrm/web test`, `pnpm test`, and `pnpm typecheck`.
- Phase 3 completed.
- Added the route-driven CRM shell, desktop layout, and resilient empty/error states.
- Phase 4 completed.
- Added CRM presentation models, sorting, badges, timestamps, and quick actions.
- Phase 5 completed.
- Added mock-backed AI draft generation, persistence of generated variants, and in-shell review.
- Phase 6 completed.
- Added rule-based follow-up recommendations, urgency labels, and next-step guidance in the shell.
- Phase 7 started.
- Added the first jobs/worker slice: queue repository methods, worker claim-and-complete cycle, jobs status API, and regression coverage for reopened sqlite connections.
- Fixed the worker integration test to avoid a false failure caused by keeping a competing sqlite connection open during worker execution.
- Validation passed: `pnpm --filter @mycrm/db test`, `pnpm --filter @mycrm/worker test`, `pnpm test`, and `pnpm typecheck`.