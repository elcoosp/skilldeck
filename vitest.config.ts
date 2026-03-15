import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Global setup for both projects
    globals: true,
    passWithNoTests: true,

    projects: [
      // Project 1: Unit Tests (Node environment for pure logic)
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          environment: 'node'
        }
      },
      // Project 2: Browser Tests (Real browser for React components)
      {
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.tsx'],
          browser: {
            enabled: true,
            // Explicitly defining the provider resolves the "Type string" error
            provider: playwright(),
            instances: [
              { browser: 'chromium' }
              // You can add 'firefox' and 'webkit' here if installed
            ]
          }
        }
      }
    ]
  }
})
