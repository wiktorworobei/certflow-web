import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const data = path.resolve('..', 'artifacts', 'e2e-data', `run-${Date.now()}`);
fs.mkdirSync(data, { recursive: true });
export default defineConfig({
  testDir: './e2e', testMatch: 'app.spec.ts', fullyParallel: false, workers: 1, retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]], timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure', screenshot: 'only-on-failure', ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1050 } },
  webServer: [
    { command: 'dotnet run --no-build --no-launch-profile --project ../src/CertFlow.Api -- --environment Testing --urls http://127.0.0.1:5181', url: 'http://127.0.0.1:5181/api/health', timeout: 120000, reuseExistingServer: false,
      env: { DaData__Enabled: 'false', Seed__SampleData: 'true', ConnectionStrings__Identity: `Data Source=${path.join(data, 'identity.db')}`, ConnectionStrings__Certification: `Data Source=${path.join(data, 'certification.db')}`, ConnectionStrings__Marking: `Data Source=${path.join(data, 'marking.db')}`, Storage__Path: path.join(data, 'uploads'), AllowedOrigins__0: 'http://127.0.0.1:5174' } },
    { command: 'npm run dev -- --port 5174', url: 'http://127.0.0.1:5174', reuseExistingServer: false, env: { API_PROXY_TARGET: 'http://127.0.0.1:5181' } },
  ],
});

