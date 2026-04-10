import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    video: {
      mode: 'on',
      size: { width: 1440, height: 900 }
    },
    screenshot: 'on',
  },
  outputDir: './test-results',
  projects: [
    {
      name: 'marketing-assets',
      testMatch: '**/*.marketing.spec.ts',
    },
  ],
});
