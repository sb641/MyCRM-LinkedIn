import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      ENABLE_AI: 'false',
      ENABLE_AUTOMATION: 'false',
      ENABLE_REAL_BROWSER_SYNC: 'false',
      ENABLE_REAL_SEND: 'false',
      LOG_LEVEL: 'info'
    }
  },
  resolve: {
    alias: {
      'server-only': path.resolve(__dirname, '../../packages/test-fixtures/src/empty-module.ts'),
      '@mycrm/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@mycrm/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@mycrm/automation': path.resolve(__dirname, '../../packages/automation/src/index.ts'),
      '@mycrm/test-fixtures': path.resolve(__dirname, '../../packages/test-fixtures/src/index.ts')
    }
  }
});
