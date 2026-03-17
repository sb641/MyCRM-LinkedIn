# MyCRM-LinkedIn Runbook

Local-first LinkedIn conversation CRM MVP built as a TypeScript monorepo.

## Current Status

Phase 12 (Hardening & Release) is in progress. The core application is feature-complete through Phase 11.

Current work is focused on improving stability, testing, and documentation for daily local use. The repository now has one primary local runtime: the working app with the web UI and worker running together.

Primary progress tracker: `docs/implementation-plan.md`

## Quick Start

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Configure environment:**
    Copy `.env.example` to `.env` and review the settings. The defaults are configured for the working local runtime, including worker-backed browser sync.
    ```bash
    cp .env.example .env
    ```

3.  **Run the application:**
    Use the main launcher:
    ```bat
    start-app.bat
    ```

    It installs dependencies if needed, ensures the local runtime flags are enabled, starts the web app and worker in separate windows, and opens the app in the browser.

4.  **If you want sync to attach to your already-open LinkedIn browser:**
    Start Chrome with remote debugging enabled so Playwright can connect over CDP.
    Example on Windows:
    ```bat
    "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
    ```

    The default local configuration uses `CHROME_CDP_URL=http://127.0.0.1:9222`.

The web interface will be available at `http://localhost:3000`.

## How to Use

### Manual Browser Sync

The application does not sync data automatically.

1.  Navigate to the CRM workspace (`/`).
2.  In the inbox workspace, click **Sync Conversations**.
3.  This will create a `sync_run` record and queue an `import_threads` job for the worker.
4.  The worker processes that job and can invoke the Playwright-backed LinkedIn sync path when a reusable browser session is available.
5.  The preferred live path is CDP reuse of an already-open Chrome session via `CHROME_CDP_URL`.
6.  If sync does not progress, check that the worker window is running and that Chrome was started with `--remote-debugging-port=9222` or another configured CDP endpoint.

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
The previous Python implementation is still present in the root for migration reference. It is not part of the new TypeScript runtime.
