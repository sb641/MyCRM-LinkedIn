# MyCRM-LinkedIn Runbook

Local-first LinkedIn conversation CRM MVP built as a TypeScript monorepo.

## Current Status

Phase 12 (Hardening & Release) is in progress. The core application is feature-complete through Phase 11.

Current work is focused on improving stability, testing, and documentation for daily local use. The repository now has one primary local runtime: the web UI and worker running together against the same workspace-root SQLite database.

Recent hardening work fixed two important runtime issues:

- the `/inbox` route no longer pulls Playwright into the web SSR bundle through `@mycrm/automation`
- relative `DATABASE_URL` values now resolve from the workspace root, so web and worker no longer drift onto separate `.mycrm/mycrm.sqlite` files when started from different directories

Real browser sync now supports two production paths:

- preferred: attach to an already-open authenticated Chrome session over `CHROME_CDP_URL`
- fallback: launch Chrome directly against `USER_DATA_DIR` using the old terminal-style persistent-profile flow

If `CHROME_CDP_URL` points to `http://127.0.0.1:9222`, a browser must actually be listening there or sync will fall back to the configured local Chrome profile when `USER_DATA_DIR` is available.

Primary progress tracker: `docs/implementation-plan.md`

## Quick Start

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Configure environment:**
    Copy `.env.example` to `.env` and review the settings. The defaults are configured for the working local runtime. Relative SQLite paths are now anchored to the workspace root, so `DATABASE_URL=file:./.mycrm/mycrm.sqlite` is safe for both web and worker.
    ```bash
    cp .env.example .env
    ```

3.  **Run the application:**
    Use the main launcher:
    ```bat
    start-app.bat
    ```

    It installs dependencies if needed, ensures the local runtime flags are enabled, starts the web app and worker in separate windows, and opens the app in the browser.

4.  **Choose a browser reuse mode:**
    - **CDP reuse:** attach to your already-open LinkedIn browser.
    Start Chrome with remote debugging enabled so Playwright can connect over CDP.
    Example on Windows:
    ```bat
    "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
    ```

    The default local configuration uses `CHROME_CDP_URL=http://127.0.0.1:9222`.

    - **Direct persistent-profile reuse:** point `USER_DATA_DIR` at the Chrome user data directory or a specific profile directory already authenticated with LinkedIn. This mirrors the old Python terminal implementation and is now available as a second production path without removing the newer CDP/session architecture.

The web interface will be available at `http://localhost:3000`.

## How to Use

### Manual Browser Sync

The application does not sync data automatically.

1.  Navigate to the CRM workspace (`/`).
2.  In the inbox workspace, click **Sync Conversations**.
3.  This will create a `sync_run` record and queue an `import_threads` job for the worker.
4.  The worker processes that job and can invoke the Playwright-backed LinkedIn sync path when a reusable browser session is available.
5.  The preferred live path is CDP reuse of an already-open Chrome session via `CHROME_CDP_URL`.
6.  If CDP is unavailable, the worker can fall back to direct persistent-profile reuse via `USER_DATA_DIR`.
7.  If sync does not progress, check these in order:
    - the worker process is running
    - the web app and worker are using the same workspace-root database
    - Chrome was started with `--remote-debugging-port=9222` or another configured CDP endpoint when using CDP reuse
    - `http://127.0.0.1:9222/json/version` responds successfully when `CHROME_CDP_URL` points there
    - `USER_DATA_DIR` points to the same Chrome profile that already has an authenticated LinkedIn session when using direct persistent-profile reuse

### Sync Failure Modes

- `MANUAL_SYNC_NOT_READY`: the app rejected the request before queueing because browser sync is disabled or no reusable browser/session path is configured
- `Queued too long, worker may be offline`: the job stayed queued without being claimed; this previously happened when web and worker were pointed at different relative SQLite files, and should now be prevented by workspace-root DB resolution
- `browserType.connectOverCDP: connect ECONNREFUSED 127.0.0.1:9222`: the worker claimed the job, but no browser was listening on the configured CDP endpoint and it may need to fall back to `USER_DATA_DIR`
- `LinkedIn redirected to login`: the configured profile is present but not authenticated for LinkedIn, or LinkedIn challenged the session before messaging loaded

### Sending a Message

1.  Select a contact and conversation from the inbox.
2.  In the **Flags and actions** panel, write a goal for the message you want to send.
3.  Click **Generate draft**.
4.  Review the generated draft variants and approve one.
5.  Once approved, click **Queue send**. This will queue a `send_message` job.

### Settings, Backup, and Restore

The settings panel is at the bottom of the right-hand column in the workspace.

-   **Save settings:** Update values and click **Save settings**. Secrets (like API keys) are stored securely outside the database and are not displayed after being saved. To clear a secret, mark it for **Reset secret** and save.
-   **Export:** Click **Export backup** to generate a JSON snapshot of your settings (secrets are excluded).
-   **Restore:** Paste a valid JSON snapshot into the **Restore/import payload** text area and click **Restore backup**. Workspace restores that replace all data require a typed confirmation before running.

## Local Data Storage

The application stores all local data in the `.mycrm/` directory at the project root:

-   `mycrm.sqlite`: The main SQLite database file.
-   `secrets.json`: An encrypted store for secret values (e.g., API keys).
-   `sessions/`: Stores browser session data for automation tasks.

This directory is ignored by Git via `.gitignore`. To reset your workspace, you can stop the application and delete the `.mycrm` directory.

Note: older runs may have created nested `.mycrm/` directories under `apps/web/` or `apps/worker/` when processes were started from different working directories. The tracked DB-path fix now resolves relative SQLite paths from the workspace root, so new runs should converge on the project-root `.mycrm/` directory.

## Development

### Workspace Layout

```txt
apps/
  web/      # Next.js frontend and API routes
  worker/   # Background job processor
packages/
  ai/
  automation/
  core/     # Shared DTOs, validation, and utilities
  db/       # Drizzle schema, repositories, and migrations
  test-fixtures/
docs/
```

### Feature Flags

Configuration is managed in the `.env` file.

```env
# App environment
NODE_ENV=development

# Path to the local SQLite database
DATABASE_URL=file:./.mycrm/mycrm.sqlite

# Browser reuse for live LinkedIn sync
CHROME_CDP_URL=http://127.0.0.1:9222
USER_DATA_DIR=
PROXY_URL=

# Enable/disable feature sets
ENABLE_AI=false
ENABLE_AUTOMATION=true
ENABLE_REAL_BROWSER_SYNC=true
ENABLE_REAL_SEND=false

# Structured logging level
LOG_LEVEL=info

# (Optional) Gemini API Key for draft generation
GEMINI_API_KEY=
```

### Common Commands

-   `start-app.bat`: Start the working local app with web and worker in separate windows.
-   `pnpm dev:web`: Run only the web app.
-   `pnpm dev:worker`: Run only the worker.
-   `pnpm lint`: Run ESLint.
-   `pnpm typecheck`: Run TypeScript compiler.
-   `pnpm build`: Build all apps and packages.

### Browser Sync Troubleshooting

- Check the CDP endpoint directly:
    ```bash
    curl http://127.0.0.1:9222/json/version
    ```
- If that request fails, the worker cannot attach to your browser over CDP. It can still use direct persistent-profile reuse if `USER_DATA_DIR` is configured and points to an authenticated Chrome profile.
- The automation layer now automatically selects the most likely authenticated Chrome profile using identity scoring from `Local State` (e.g., preferring "Profile 1" or "Default").
- Cloning for CDP-assisted sync is optimized to skip huge cache and session directories, significantly reducing disk space requirements and improving startup speed.
- The direct persistent-profile path intentionally mirrors the old Python terminal implementation: it launches Chrome with `launchPersistentContext(USER_DATA_DIR, ...)` and opens LinkedIn messaging directly.
- If sync jobs remain queued, make sure you do not have stale web or worker processes started from other directories.
- If needed, stop all Node processes for this repo and restart from the repo root so both services share the same runtime and database.

## How to Test

-   **Run all tests:**
    ```bash
    pnpm test
    ```

-   **Run tests for a specific package (e.g., the web app):**
    ```bash
    pnpm --filter @mycrm/web test
    ```

-   **Run End-to-End (E2E) tests:**
    This is the dedicated test-only path and runs Playwright tests against a temporary database.
    ```bash
    pnpm --filter @mycrm/web test:e2e:run
    ```

## Legacy Code
The previous Python implementation is still present in the root for migration reference. Its direct persistent Chrome profile logic has now been ported into the TypeScript automation layer as a secondary production path, while the newer CDP/session-based architecture remains in place.
