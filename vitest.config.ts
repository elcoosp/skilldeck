import path from 'node:path'
import { playwright } from '@vitest/browser-playwright'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    // Global setup for both projects
    globals: true,
    passWithNoTests: true,
    coverage: {
      provider: 'istanbul',
      all: true,
      reportOnFailure: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/lib/bindings.ts',
        'src/routeTree.gen.ts',
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/**/*.test.{ts,tsx}',
        'src/__tests__/**'
      ],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage'
    },

    projects: [
      // Project 1: Unit Tests (Node environment for pure logic)
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          exclude: [...configDefaults.exclude, 'src/**/*.browser.test.tsx'],
          environment: 'happy-dom',
          setupFiles: ['./src/__tests__/setup.ts'],
          alias: {
            '@': path.resolve(__dirname, './src')
          }
        }
      },
      // Project 2: Browser Tests (Real browser for React components)
      {
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.tsx'],
          alias: {
            '@': path.resolve(__dirname, './src')
          },
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
