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
| [x] | 9 | Real Browser-Assisted Sync | Completed with dual-path execution (CDP + persistent profile), robust cloning optimizations, and validated LinkedIn session reuse |
| [x] | 10 | User-Approved Send Workflow | Completed with queueing, worker execution, fake-provider coverage, and real-browser provider send wiring |
| [x] | 11 | Settings, Secrets, Security, Backup/Restore | Completed with settings UI/API, local secret storage, workspace-scoped backup export/restore semantics, redaction, import/reset hardening, and restore review safeguards |
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

Status: `[!] Needs review / repair`

Goal:
Make real LinkedIn browser-assisted sync work safely against a live logged-in browser session without relying on CI or automatic credential login.

Implementation checklist:
- [x] Add guarded real-browser sync entry path behind feature flags
- [x] Add session storage abstraction and legacy session bootstrap
- [x] Add persistent-profile browser reuse helper
- [x] Add CDP connection helper for an already-open Chrome session
- [ ] Repair `createBrowserSyncProvider(...)` so provider selection is valid and deterministic
- [ ] Make provider precedence explicit: `CHROME_CDP_URL` first, then `USER_DATA_DIR`, then saved-cookie fallback
- [ ] Remove stray/partial `REMOTE_DEBUGGING_URL` patch logic and keep one canonical browser connection config path
- [ ] Promote CDP from helper-only code to the default real-browser provider path
- [ ] Keep persistent-profile reuse as fallback only, not the default live-account path
- [ ] Remove automatic username/password login from the normal real-browser flow and fail with actionable guidance instead
- [ ] Refactor thread/message extraction so CDP and persistent-profile paths share the same import logic
- [ ] Add tests for provider selection precedence and session reuse behavior
- [ ] Run a live smoke validation against an already-open Chrome with remote debugging enabled

Validation:
- [x] `pnpm --filter @mycrm/automation test`
- [x] `pnpm --filter @mycrm/automation typecheck`
- [ ] `pnpm --filter @mycrm/automation test` after provider repair and new coverage
- [ ] Live browser smoke test proves LinkedIn messaging opens without redirecting to login
- [ ] Live browser smoke test proves the automation disconnects without closing the user's browser

Notes:
- CI must continue to use fake/mock providers only.
- Real browser sync is a local operator workflow and should prefer CDP attachment to an already-open authenticated Chrome session.

## Phase 10

Status: `[!] Needs review / repair`

Goal:
Keep send explicit and user-approved while completing the missing real browser send implementation on top of the repaired browser provider path.

Implementation checklist:
- [x] Add approved-draft send API and queue flow
- [x] Add worker `send_message` handling and audit trail
- [x] Add duplicate-send safety guard and fake-provider validation
- [ ] Implement real `sendMessage(...)` on the chosen real-browser provider, starting with the CDP-backed path
- [ ] Reuse the same browser session strategy for send that is used for sync
- [ ] Add per-account serialization and pacing for browser send actions
- [ ] Add explicit tests for real-send provider selection and guarded failure modes
- [ ] Run an approved-draft live send smoke test only after Phase 9 browser repair is complete

Validation:
- [x] Queue/send API and worker tests pass with fake provider
- [ ] Real browser send succeeds through the approved-draft flow in a local smoke test
- [ ] Real browser send respects feature flags and does not bypass approval

Notes:
- Phase 10 remains dependent on the repaired Phase 9 browser path.
- Do not treat the guarded seam as production-complete until real browser send is implemented and validated.

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

Status: `[x] Completed`

Goal:
Make the app safe and operable locally.

Implementation checklist:
- [x] Settings UI
- [x] Secret storage
- [x] Backup/export
- [x] Restore/import
- [x] Log redaction
- [x] Tests and docs update

Current slice status:
- [x] Initial settings UI in the CRM shell
- [x] Local secret storage abstraction with redacted display
- [x] Settings backup/export and restore/import API routes
- [x] Recursive structured-log redaction for common sensitive fields
- [x] Focused tests for settings API, backup API, page rendering, and logger redaction
- [x] Import validation hardening and explicit secret reset controls in the shell
- [x] Operator guidance for export/import/reset behavior in the settings panel and manual test plan
- [x] Secret-preservation and secret-clearing coverage for merge vs replace settings/workspace restores
- [x] Restore payload preview and destructive replace confirmation safeguards in the shell

Validation:
- [x] `pnpm --filter @mycrm/core test`
- [x] `pnpm --filter @mycrm/db test -- --run src/schema.integration.test.ts`
- [x] `pnpm --filter @mycrm/web test -- --run app/api/settings/route.test.ts app/api/backup/route.test.ts app/page.test.tsx`
- [x] `pnpm --filter @mycrm/web test -- --run lib/services/settings-service.test.ts`

Review gate:
- [ ] Human review before Phase 12

## Phase 12

Status: `[-] In progress`

Goal:
Harden the MVP for daily use.

Implementation checklist:
- [ ] Regression E2E flows
- [-] Performance validation
- [x] Error boundaries
 - [-] Final README and runbook
 - [ ] Docker/local run instructions
 - [ ] Release checklist

Current slice status:
- [x] Global App Router error boundary for unexpected route render failures
- [x] Retry affordance and failure details in the fallback UI
- [x] Focused component coverage for the error fallback path
- [x] Initial Playwright E2E scaffolding and isolated E2E database setup
- [x] Regression E2E coverage for CRM shell load, settings save/export, manual sync enqueue, approved send enqueue, and guarded workspace restore
- [-] Performance validation: added baseline server-side data load timer for the main workspace shell
- [-] Final README and runbook: updated with local runbook instructions
 - [ ] Docker/local run instructions
 - [ ] Release checklist

Review gate:
- [ ] Human review before release

## Progress Log

### 2026-03-13
- Phase 12 started with a first hardening slice in the web app.
- Added a global App Router error boundary in `apps/web/app/error.tsx` so unexpected route render failures land in a controlled fallback instead of a raw crash.
- Added a retry action plus surfaced error message and digest in the fallback UI for local operator recovery.
- Added focused component coverage for the new error boundary fallback.
- Added initial Playwright configuration in `apps/web/playwright.config.ts` and a first CRM shell smoke test in `apps/web/e2e/crm-shell.spec.ts`.
- Added an isolated Playwright database preparation script in `apps/web/scripts/prepare-e2e.ts` so E2E runs do not mutate the default local workspace database.
- Expanded Playwright regression coverage to exercise settings save/export, manual sync enqueue, approved send enqueue, and guarded workspace replace restore behavior.
- Phase 11 started with an initial vertical slice for settings, secrets, backup/restore, and log redaction.
- Added settings DTOs and validation contracts in `@mycrm/core`.
- Added recursive log redaction for common secret, token, cookie, and session fields in the shared logger.
- Added a local file-backed secret store under `.mycrm/secrets.json` and a settings repository on top of the existing `settings` table.
- Added `/api/settings` and `/api/backup` routes plus web services for listing, updating, exporting, and importing settings snapshots.
- Added a Phase 11 settings panel to the CRM shell with save, export, and restore actions.
- Hardened settings import validation to reject duplicate keys and empty secret payloads.
- Added explicit secret reset controls in the CRM shell so operators can clear stored secrets without deleting the setting key.
- Added operator-facing guidance in the settings panel and manual test plan for export/import/reset behavior.
- Added db integration coverage proving merge imports preserve omitted secrets while replace imports clear omitted secrets for both settings-only and workspace restore flows.
- Added a client-side restore payload preview so operators can review scope, mode, settings count, secret-entry count, and workspace record counts before running a restore.
- Validation passed: `pnpm --filter @mycrm/core test` and `pnpm --filter @mycrm/web test -- --run app/api/settings/route.test.ts app/api/backup/route.test.ts app/page.test.tsx`.
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
- Added manual smoke notes for saving a browser session, queueing manual sync, and verifying operator-facing retry guidance when real browser execution fails or requires operator intervention.
- Validation passed: `pnpm --filter @mycrm/automation test`, `pnpm --filter @mycrm/worker test -- --run src/index.test.ts`, and `pnpm --filter @mycrm/web test -- --run app/page.test.tsx lib/crm-shell.test.ts app/api/browser-session/route.test.ts app/api/jobs/route.test.ts`.
