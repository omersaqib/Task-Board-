// Root ESLint flat config for every workspace (backend, frontend, playwright)
// plus repo-level scripts and config files.
//
// Changes to this file are CODEOWNERS-protected: disabling rules or widening
// `ignores` can silently weaken the quality gate.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const unusedVarsOptions = {
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_',
  destructuredArrayIgnorePattern: '^_',
};

export default defineConfig(
  globalIgnores(
    [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/blob-report/**',
      'backend/data/**', // SQLite files only; a broad '**/data/**' could hide test sources
      'logs/**',
      'docs/sample-report/**',
    ],
    'taskboard/ignores',
  ),

  // Base rules for all JS/TS.
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    name: 'taskboard/unused-vars',
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', unusedVarsOptions],
    },
  },

  // Node.js code: backend, Playwright, repo scripts and tool config files.
  {
    name: 'taskboard/node',
    files: [
      'backend/**/*.{ts,js,mjs,cjs}',
      'playwright/**/*.{ts,js,mjs,cjs}',
      'scripts/**/*.{ts,js,mjs,cjs}',
      '*.{js,mjs,cjs,ts}',
      '*/*.config.{ts,js,mjs,cjs}',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // React app.
  {
    name: 'taskboard/frontend',
    files: ['frontend/src/**/*.{ts,tsx}', 'frontend/tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    ...reactHooks.configs.flat.recommended,
    name: 'taskboard/react-hooks',
    files: ['frontend/src/**/*.{ts,tsx}'],
  },

  // Playwright tests: focused/skipped tests and hard waits are hard errors so
  // that nobody can quietly exclude tests from the CI gate.
  {
    ...playwright.configs['flat/recommended'],
    name: 'taskboard/playwright-tests',
    files: ['playwright/tests/**/*.ts'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': 'error',
      'playwright/no-wait-for-timeout': 'error',
    },
  },
);
