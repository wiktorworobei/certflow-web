import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './marking-tests', testMatch: '*.test.ts', workers: 1,
  reporter: 'list', timeout: 10000, fullyParallel: false,
});
