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
| [ ] | 2 | Core Repositories and Service Layer | Pending |
| [ ] | 3 | UI Shell and Navigation | Pending |
| [ ] | 4 | Contact List, Conversation Viewer, and CRM Status Engine | Pending |
| [ ] | 5 | Draft Workflow and Gemini Integration | Pending |
| [ ] | 6 | Follow-up Recommendation Engine | Pending |
| [ ] | 7 | Jobs, Worker, and Queueing | Pending |
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

Status: `[ ] Not started`

Goal:
Create repositories, services, DTOs, validation, and initial API routes.

Implementation checklist:
- [ ] Repository CRUD helpers
- [ ] Service layer with validation
- [ ] DTOs and Zod schemas
- [ ] Error model
- [ ] Transaction helpers
- [ ] Initial API routes
- [ ] Unit and integration tests
- [ ] Docs update

## Phase 3

Status: `[ ] Not started`

Goal:
Build the working desktop layout and state flow.

Implementation checklist:
- [ ] App shell and navigation
- [ ] Top bar actions
- [ ] Route/state model
- [ ] Empty/loading/error states
- [ ] UI tests and E2E smoke
- [ ] Docs update

## Phase 4

Status: `[ ] Not started`

Goal:
Make the CRM useful before AI.

Implementation checklist:
- [ ] Contact list and conversation history
- [ ] CRM badges and timestamps
- [ ] Relationship status derivation rules
- [ ] Sorting and quick actions
- [ ] Unit/integration/component tests
- [ ] Docs update

## Phase 5

Status: `[ ] Not started`

Goal:
Implement AI draft generation, review, approval, and storage.

Implementation checklist:
- [ ] Gemini adapter contract and implementation
- [ ] Prompt builder
- [ ] Draft validators
- [ ] Draft generation API
- [ ] Variants persistence
- [ ] Draft approval/edit/copy UI
- [ ] Mocked AI tests
- [ ] Docs update

Review gate:
- [ ] Human review before Phase 6

## Phase 6

Status: `[ ] Not started`

Goal:
Add rule-based follow-up recommendations.

Implementation checklist:
- [ ] Follow-up rules engine
- [ ] `followup_due_at` support
- [ ] UI reminders and CTA
- [ ] Tests and docs update

## Phase 7

Status: `[ ] Not started`

Goal:
Move long-running tasks into the worker and queue.

Implementation checklist:
- [ ] Job types and transitions
- [ ] Locking and retry policy
- [ ] Audit logging for jobs
- [ ] Polling endpoint/UI
- [ ] Worker integration tests
- [ ] Docs update

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