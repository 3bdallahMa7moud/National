import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(globalThis.process?.env.CI);
const frontendBaseUrl = 'http://127.0.0.1:4174';
const backendBaseUrl = 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: 'list',
  outputDir: 'test-results',
  use: {
    baseURL: frontendBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  webServer: [
    {
      command: 'npm run start:server:dist',
      url: `${backendBaseUrl}/api/health`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        PORT: '3100',
        APP_ORIGIN: frontendBaseUrl,
        DATABASE_URL: 'file:./prisma-e2e.db',
        SESSION_SECRET: 'test-session-secret-1234567890',
        ENABLE_DEV_PASSWORD_RESET_CODES: 'true',
        ENABLE_DEV_SIGNUP_OTP_CODES: 'true',
      },
    },
    {
      command: 'npm run preview:e2e',
      url: frontendBaseUrl,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
