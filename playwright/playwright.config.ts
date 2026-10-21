import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { API_URL, BASE_URL } from './utils/env.ts';

const isCI = !!process.env.CI;
const repoRoot = path.resolve(import.meta.dirname, '..');
const dbPath = path.resolve(import.meta.dirname, '.cache/e2e.db');
const skipWebServer = process.env.PW_SKIP_WEBSERVER === '1';

// Removes any stale throwaway DB before the API starts (only runs when we launch the server).
const resetDb = `node -e "const fs=require('fs');const p=process.argv[1];fs.mkdirSync(require('path').dirname(p),{recursive:true});for(const s of ['','-wal','-shm','-journal'])fs.rmSync(p+s,{force:true})" "${dbPath}"`;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results/artifacts',
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [
    [isCI ? 'github' : 'list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'api', testMatch: 'api/**/*.spec.ts' },
    {
      name: 'chromium',
      testIgnore: 'api/**',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: `${resetDb} && npm run start -w backend`,
          cwd: repoRoot,
          url: `${API_URL}/api/health`,
          env: {
            DATABASE_PATH: dbPath,
            PORT: new URL(API_URL).port || '3001',
            JWT_SECRET:
              process.env.JWT_SECRET ?? 'playwright-e2e-secret-not-for-production-0123456789',
            AUTH_RATE_LIMIT_PER_MINUTE: '0',
          },
          reuseExistingServer: true,
          timeout: 60_000,
        },
        {
          command: `npm run preview -w frontend -- --port ${new URL(BASE_URL).port || '4173'}`,
          env: { API_PROXY_TARGET: API_URL },
          cwd: repoRoot,
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 60_000,
        },
      ],
});
