import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'ui.spec.ts', workers: 1, reporter: 'list', timeout: 30000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5175', viewport: { width: 1440, height: 1050 }, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --port 5175', url: 'http://127.0.0.1:5175', reuseExistingServer: false },
});
