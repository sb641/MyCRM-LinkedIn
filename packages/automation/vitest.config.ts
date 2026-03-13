import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@mycrm/test-fixtures': path.resolve(__dirname, '../test-fixtures/src/index.ts'),
      '@mycrm/core': path.resolve(__dirname, '../core/src/index.ts')
    }
  },
  test: {
    environment: 'node',
    globals: true,
    passWithNoTests: true
  }
});
