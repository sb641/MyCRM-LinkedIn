# Test Plan

The test plan is phased and expands with each vertical slice.

## Automated

- lint
- typecheck
- unit tests for env validation and logger output
- integration tests for schema, migrations, seed data, and repository behavior
- route and service tests for inbox reads and CRM write mutations
- route and service tests for mock AI draft generation and persistence
- shell state tests for route selection, sorting, derived relationship status, and CRM presentation metadata
- page rendering tests for the Phase 5 desktop shell, quick actions, draft panel, and draft generation controls
- shell state tests for follow-up urgency, due labels, and follow-up CTA derivation
- page rendering tests for follow-up reminders in the contact summary
- smoke tests for app shell and worker bootstrap

## Manual

- start web app locally
- start worker locally
- verify `/api/health` returns OK
- verify feature flags render in settings panel
- verify the workspace selects the first conversation when no query params are present
- verify `contactId` and `conversationId` query params switch the selected conversation
- verify the `sort` query param changes inbox ordering without breaking selection
- verify badges and quick actions reflect seeded CRM state
- verify the draft panel renders saved drafts for the selected conversation
- verify the draft panel accepts a goal and can request generated variants through the mock AI path
- verify the generated preview renders without leaving the current conversation context
- verify the contact summary shows a follow-up label and urgency callout when a thread is awaiting reply
- verify empty and error states render without crashing the shell
- save a browser session with `POST /api/browser-session` for `local-account` and verify `GET /api/browser-session?accountId=local-account` returns the saved payload
- enable `ENABLE_REAL_BROWSER_SYNC=true`, queue manual sync from the CRM shell, and verify the active sync state appears without breaking the rest of the workspace
- verify the shell shows browser-session readiness before queueing sync and surfaces operator guidance when the worker reports missing or stale session failures
- verify a saved-session manual sync currently lands in retry-needed guidance because Playwright execution is still intentionally stubbed in Phase 9

## Current validation commands

```bash
pnpm --filter @mycrm/web test
pnpm test
pnpm typecheck
```
