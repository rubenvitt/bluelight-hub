import { defineConfig, devices } from '@playwright/test';

const IS_CI = process.env.CI === 'true';
const BASE_URL = process.env.E2E_FRONTEND_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  testMatch: /specs\/.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: IS_CI ? 2 : 0,
  // P27 (Review): Reporter ausschliesslich hier konfigurieren — `test:e2e:ci`-Script verzichtet
  // auf `--reporter`-CLI-Override, damit der HTML-Report nicht verloren geht. Audit-Bericht
  // Sektion 1 dokumentiert `playwright-report/` als Artifact.
  reporter: IS_CI ? [['github'], ['junit', { outputFile: 'test-results/junit.xml' }], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/setup/global-setup.ts',
  globalTeardown: './e2e/setup/global-teardown.ts',
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
