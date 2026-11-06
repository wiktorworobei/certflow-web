import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({ ...config, testMatch: 'builder.spec.ts' });
