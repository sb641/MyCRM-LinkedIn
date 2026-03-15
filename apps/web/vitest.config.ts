import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
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
    alias: [
      { find: '@', replacement: path.resolve(__dirname, '.') },
      { find: '@mycrm/core', replacement: path.resolve(__dirname, '../../packages/core/src/index.ts') },
      { find: /^@mycrm\/db\/server$/, replacement: path.resolve(__dirname, '../../packages/db/src/server/index.ts') },
      { find: '@mycrm/db', replacement: path.resolve(__dirname, '../../packages/db/src/index.ts') },
      { find: /^server-only$/, replacement: path.resolve(__dirname, './test/server-only.ts') }
    ]
  }
});
