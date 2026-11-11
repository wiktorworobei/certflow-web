import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'fgis.spec.ts', outputDir: './test-results/fgis', workers: 1, reporter: 'list', timeout: 45000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5176', viewport: { width: 1440, height: 1050 }, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --port 5176', url: 'http://127.0.0.1:5176', reuseExistingServer: false },
});
