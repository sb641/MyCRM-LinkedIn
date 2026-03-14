import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const e2eDatabaseUrl = 'file:./.e2e/playwright.sqlite';
const workspaceRoot = path.resolve(__dirname, '../..');
const webRoot = path.resolve(__dirname);
const e2ePort = 3417;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${e2ePort}`,
    trace: 'on-first-retry'
  },
  webServer: {
    command: `pnpm --dir "${webRoot}" exec next dev --hostname 127.0.0.1 --port ${e2ePort}`,
    url: `http://127.0.0.1:${e2ePort}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: 'development',
      DATABASE_URL: e2eDatabaseUrl,
      ENABLE_AI: 'false',
      ENABLE_AUTOMATION: 'false',
      ENABLE_REAL_BROWSER_SYNC: 'false',
      ENABLE_REAL_SEND: 'false',
      LOG_LEVEL: 'info'
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});