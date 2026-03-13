import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@mycrm/core': path.resolve(import.meta.dirname, '../core/src/index.ts'),
      '@mycrm/core/*': path.resolve(import.meta.dirname, '../core/src/*')
    }
  },
  test: {
    environment: 'node',
    globals: true,
    passWithNoTests: true,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      ENABLE_AI: 'false',
      ENABLE_AUTOMATION: 'false',
      ENABLE_REAL_BROWSER_SYNC: 'false',
      ENABLE_REAL_SEND: 'false',
      LOG_LEVEL: 'info'
    }
  }
});
