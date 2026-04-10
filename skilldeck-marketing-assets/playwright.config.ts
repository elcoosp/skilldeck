import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    video: 'on',          // Playwright's own video (browser mode)
    screenshot: 'on',
  },
  outputDir: './test-results',
  projects: [
    {
      name: 'marketing-assets',
      testMatch: 'tests/**/*.marketing.spec.ts',
      use: { mode: 'tauri' }, // Use the real Tauri app
    },
  ],
});
