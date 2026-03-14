# MyCRM-LinkedIn Runbook

Local-first LinkedIn conversation CRM MVP built as a TypeScript monorepo.

## Current Status

Phase 12 (Hardening & Release) is in progress. The core application is feature-complete through Phase 11.

Current work is focused on improving stability, testing, and documentation for daily local use. Real browser automation for sync and send operations remains intentionally stubbed and must be triggered manually from the UI.

Primary progress tracker: `docs/implementation-plan.md`

## Quick Start

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Configure environment:**
    Copy `.env.example` to `.env` and review the settings. The defaults are configured for a standard local-only run.
    ```bash
    cp .env.example .env
    ```

3.  **Run the application:**
    This command starts the Next.js web app and the backend worker concurrently.
    ```bash
    pnpm dev
    ```

The web interface will be available at `http://localhost:3000`.

## How to Use

### Manual Browser Sync

The application does not sync data automatically.

1.  Navigate to the CRM workspace (`/`).
2.  In the **Manual browser sync** panel, click **Queue browser sync**.
3.  This will create a `sync_run` record and queue an `import_threads` job for the worker.
4.  Since real browser automation is not implemented, the job will eventually time out and await manual intervention or retry.

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

# Enable/disable feature sets
ENABLE_AI=false
ENABLE_AUTOMATION=false
ENABLE_REAL_BROWSER_SYNC=false
ENABLE_REAL_SEND=false

# Structured logging level
LOG_LEVEL=info

# (Optional) Gemini API Key for draft generation
GEMINI_API_KEY=
```

### Common Commands

-   `pnpm dev`: Run web and worker apps.
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
    This runs Playwright tests against a dedicated, temporary database.
    ```bash
    pnpm --filter @mycrm/web test:e2e:run
    ```

## Legacy Code
The previous Python implementation is still present in the root for migration reference. It is not part of the new TypeScript runtime.
