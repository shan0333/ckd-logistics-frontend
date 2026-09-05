import { defineConfig, devices } from '@playwright/test';
import { loadTestEnv } from './tests/support/env';

const env = loadTestEnv();

/**
 * CKD Logistics — E2E test config.
 *
 * Targets a locally-served build of this frontend (`next dev` on :3000) talking to the
 * real Logistics-backend on :5000. The backend must already be running — Playwright only
 * starts the frontend. See tests/README.md for the safety notes on the "live backend"
 * target (Create/Delete tests write to the shared production `Spaceage` RDS schema and are
 * gated behind ALLOW_WRITE_TESTS=1).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  globalSetup: './tests/support/global-setup.ts',

  use: {
    baseURL: env.baseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: env.baseUrl,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_API_URL: env.apiUrl,
      NEXT_PUBLIC_BASE_PATH: '',
    },
  },
});
