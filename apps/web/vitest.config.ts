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
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@mycrm/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@mycrm/db': path.resolve(__dirname, '../../packages/db/src/index.ts')
    }
  }
});
