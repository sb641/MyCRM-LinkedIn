# MyCRM-LinkedIn Context

This file is the short restart point for a new chat.

## Project

- Local-first LinkedIn conversation CRM MVP
- TypeScript monorepo
- Main runtime surfaces: `apps/web` and `apps/worker`
- Shared packages: `packages/core`, `packages/db`, `packages/ai`, `packages/automation`, `packages/test-fixtures`

## Current phase status

- Phase 0 to Phase 8: completed in code
- Phase 9: completed with repaired dual-path browser sync (CDP + persistent profile), robust profile selection, and cloning optimizations
- Phase 10: approval and queue-send flow are implemented, and real browser send is wired to the same dual-path automation layer
- Phase 11: completed with settings UI/API, explicit secret reset controls, local secret storage, workspace-scoped backup export/restore semantics, redaction, import/reset hardening, secret-preservation coverage, and restore review safeguards
- Phase 12: not started yet

## Important constraints

- Real browser execution now has two guarded sync paths: CDP reuse of an already-open browser and direct persistent-profile reuse via `USER_DATA_DIR`
- `ENABLE_REAL_BROWSER_SYNC` and `ENABLE_REAL_SEND` unlock guarded seams; they still require either a reachable CDP endpoint or a reusable authenticated browser profile/session before they should be treated as complete
- Keep work scoped to `MyCRM-LinkedIn` only
- Continue phases sequentially from `docs/implementation-plan.md`

## Recent fixes and findings

- Fixed the `/inbox` SSR failure caused by the web layer importing Playwright-bearing automation code through `@mycrm/automation`
- Added inbox sync diagnostics and worker lifecycle logging so queued, running, failed, and stalled states are visible in the UI and logs
- Corrected manual sync readiness checks so placeholder `legacy_profile_imported` cookies no longer count as a usable saved session
- Fixed a runtime split where web and worker could use different SQLite files when `DATABASE_URL` was relative; `packages/db/src/server/get-db.ts` now resolves relative SQLite paths from the workspace root
- Ported the old Python terminal `launch_persistent_context(USER_DATA_DIR, ...)` approach into the TypeScript automation layer as a direct persistent-profile provider and bootstrap capture path
- The current live sync path order is: CDP reuse, direct persistent-profile reuse, copied-profile fallback, then saved-cookie session fallback

## Recommended next work

Finish the browser work before starting Phase 12:

1. Validate live sync against the new direct persistent-profile path with the real LinkedIn profile and confirm the last 10 chats persist into inbox
2. Complete real browser send on top of the repaired dual-path provider flow
3. Add stronger preflight diagnostics that distinguish CDP reuse from direct persistent-profile reuse
4. Then start Phase 12 hardening, regression coverage, and release readiness

## Key docs

- Main plan: `docs/implementation-plan.md`
- Architecture: `docs/architecture.md`
- Test plan: `docs/test-plan.md`
- Project overview: `README.md`
