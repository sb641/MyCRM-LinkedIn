# MyCRM-LinkedIn

This repository is being rebuilt into a local-first LinkedIn conversation CRM MVP.

## Current status

Phase 0 is now the active baseline:

- pnpm monorepo
- Next.js web shell
- worker skeleton
- shared TypeScript packages
- env validation with Zod
- structured logging with Pino
- feature flags for AI and automation
- mock adapters as the default integration path

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

## Phase 0 acceptance checklist

- monorepo boots with pnpm
- web app exposes `/api/health`
- worker starts locally
- feature flags are visible in the app shell
- lint, typecheck, tests, and build pass

## Phase 1 database workflow

```bash
pnpm db:migrate
pnpm db:seed
pnpm test:integration
```

Schema, migrations, and progress tracking live in `packages/db` and `docs/implementation-plan.md`.

## Legacy code

The previous Python implementation is still present in the root for migration reference. It is not part of the new Phase 0 runtime.
