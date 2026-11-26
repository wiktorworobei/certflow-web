import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: /(?:crpt(?:-card|-documents|-turnover)?|suz)\.spec\.ts/, outputDir: './test-results/crpt', workers: 1, reporter: 'list', timeout: 30000,
  use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL, baseURL: 'http://127.0.0.1:5187', viewport: { width: 1440, height: 1050 }, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --port 5187', url: 'http://127.0.0.1:5187', reuseExistingServer: !process.env.CI },
});
