# Architecture

The project is a local-first LinkedIn conversation CRM MVP built as a TypeScript monorepo.

## Workspace layout

- `apps/web`: Next.js app shell and API routes.
- `apps/worker`: background worker skeleton.
- `packages/core`: env validation, feature flags, logger, shared domain primitives.
- `packages/ai`: Gemini adapter contract and mock implementation.
- `packages/automation`: automation provider contract and mock implementation.
- `packages/db`: SQLite schema, migrations, seed data, and connection helpers.
- `packages/test-fixtures`: shared fixtures for tests.

## Phase 1 data layer

- Drizzle defines the SQLite schema and migration flow.
- CRM state is separated into `relationship_status`, `draft_status`, and `send_status`.
- The database package owns seed data for deterministic local development and tests.
- Web and worker packages will consume the same schema package in later phases.

## Phase 2 application layer

- `packages/core` owns shared DTO schemas and application error types.
- `packages/db` exposes repository helpers for inbox reads, contact detail reads, and CRM write mutations.
- `apps/web` uses a service layer between API routes and repositories.
- Under the current local `sql.js` runtime, joined read models and simple write mutations use direct SQL over the shared SQLite connection for predictable behavior.

## Phase 3 shell and state flow

- `apps/web/app/page.tsx` is the server entry point for the CRM workspace.
- The page loads inbox data, derives selection from URL search params, and fetches the selected contact conversation details.
- `apps/web/app/crm-shell.tsx` is the client shell responsible for desktop layout, navigation links, top bar actions, and resilient UI states.
- Route state is driven by `contactId` and `conversationId` query params with fallback to the first inbox item.
- The shell explicitly supports `ready`, `empty`, and `error` states so later phases can deepen the UI without changing the top-level flow.

## Phase 4 CRM presentation layer

- `apps/web/lib/crm-shell.ts` now owns a presentation model on top of DTOs returned by the service layer.
- Inbox items are enriched with derived priority, relative timestamps, badges, and quick actions before rendering.
- Contact details are enriched with derived relationship status, next-step guidance, contact badges, and draft summaries.
- The inbox supports URL-preserved sorting modes: `recent`, `needs-attention`, and `name`.
- The main workspace now renders three CRM-focused surfaces from live data: contact summary, conversation history, and draft history.
- Phase 4 keeps all derivation logic in the web presentation layer so later AI and automation phases can reuse the same shell contract.

## Phase 5 AI draft generation

- `packages/ai` now exposes a draft-generation contract, a prompt builder, and a mock Gemini adapter that returns deterministic variants for local development and tests.
- `packages/core` owns validation schemas for draft-generation requests and generated variant payloads.
- `packages/db` persists generated drafts and draft variants into the existing `drafts` and `draft_variants` tables without changing the Phase 1 schema.
- `apps/web/lib/services/crm-service.ts` now orchestrates prompt building, mock AI generation, validation, and persistence for generated drafts.
- `apps/web/app/api/drafts/generate/route.ts` exposes the generation flow as a local API endpoint for the shell.
- `apps/web/app/crm-shell.tsx` now includes a draft goal input and generated preview area inside the draft panel so users can trigger and review AI-assisted drafts before approval.

## Phase 6 follow-up recommendations

- Phase 6 introduces a rule-based follow-up recommendation layer in `apps/web/lib/crm-shell.ts`.
- Follow-up timing is currently derived from existing CRM timestamps instead of a persisted database column, which keeps the slice local-first and avoids a schema migration before the rules stabilize.
- The presentation layer now computes `followupDueAt`, urgency, due labels, and next-step guidance from relationship status plus recent inbound/outbound activity.
- Contact badges and quick actions now surface follow-up urgency directly in the shell.
- `apps/web/app/crm-shell.tsx` renders a follow-up field and urgency callout so the operator can see when outreach is due before generating or approving a draft.

## Phase 7 jobs and worker slice

- Phase 7 introduces the first queue-backed worker flow while keeping the product local-first.
- `packages/db` now exposes job queue helpers for enqueue, claim, list, success, and failure transitions.
- The queue now includes a basic locking and retry policy: stale `running` jobs are re-queued after a lock timeout, and failed jobs are rescheduled before becoming terminally failed.
- Job lifecycle transitions are now written into the shared `audit_log` table so queue activity can be inspected without attaching a debugger.
- `apps/worker/src/index.ts` now runs a single worker cycle that claims the next queued job, logs processing, and marks the job as succeeded, retry-scheduled, or failed.
- `apps/web/app/api/jobs/route.ts` exposes a read-only jobs status endpoint for observability, and each returned job now includes its audit trail entries.
- The current worker model is a separate long-running process, not a Vercel-native background runtime.
- A db-level regression test now verifies that job status transitions persist across reopened sqlite connections.

## Phase 8 automation adapter slice

- Phase 8 starts with a testable automation package instead of a real browser integration.
- `packages/automation` now exposes a richer messaging provider contract for listing threads and loading thread messages.
- The package includes a fake provider backed by deterministic DOM fixtures so parsing and provider behavior can be tested without LinkedIn or Playwright.
- The automation package now also exposes deterministic mock import helpers so worker flows can simulate thread sync without a real provider session.
- A lightweight in-memory session store now defines the session storage abstraction that later browser-backed providers will implement.
- The Playwright provider exists only as a guarded skeleton in this phase and intentionally throws until the real browser-assisted sync phase begins.
- Shared fixture data is consumed from `packages/test-fixtures` so automation tests stay deterministic and local-first.
- `apps/worker` now processes `import_threads` jobs through the fake automation flow and persists sync summaries into the shared `sync_runs` table.
- `apps/web` now reads recent `sync_runs` through the jobs service layer and surfaces them in the CRM shell for local observability.
- This keeps the queue, worker, and automation layers integrated under local deterministic fixtures before any real browser sync is introduced.

## Guardrails

- AI and automation are behind feature flags.
- Mock adapters are the default path for tests and local development.
- Real browser sync and real send remain disabled by default.
- Sending stays user-triggered in later phases.
- The concrete real-send method is intentionally deferred: before Phase 10 implementation, the project must present send-path options to the user and implement only the user-approved approach.
