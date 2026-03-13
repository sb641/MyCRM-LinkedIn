import js from '@eslint/js';
import nextPlugin from 'eslint-config-next';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/node_modules/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextPlugin,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error'
    }
  }
];
