import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'session-security.spec.ts',
  outputDir: './test-results/security',
  workers: 1,
  reporter: 'list',
  timeout: 30000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5188',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5188',
    url: 'http://127.0.0.1:5188',
    reuseExistingServer: false,
  },
});
