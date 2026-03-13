# Architecture

Phase 0 establishes a local-first monorepo for the LinkedIn conversation CRM MVP.

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

## Guardrails

- AI and automation are behind feature flags.
- Mock adapters are the default path for tests and local development.
- Real browser sync and real send remain disabled by default.
- Sending stays user-triggered in later phases.
