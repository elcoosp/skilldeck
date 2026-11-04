import { defineConfig } from '@playwright/test'

const cdp = process.env.E2E_MODE === 'cdp'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 120000,
  outputDir: 'test-results',
  reporter: [['list']],
  projects: cdp
    ? [
        {
          name: 'tauri-cdp',
          use: {
            mode: 'cdp',
            browserName: 'chromium',
            cdpEndpoint: process.env.CDP_ENDPOINT ?? 'http://localhost:9222'
          } as unknown as object
        }
      ]
    : [
        {
          name: 'tauri-socket',
          use: {
            mode: 'tauri',
            browserName: 'chromium'
          } as unknown as object
        }
      ]
})
