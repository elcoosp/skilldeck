import type { LinguiConfig } from '@lingui/conf'

const config: LinguiConfig = {
  locales: ['en'],
  sourceLocale: 'en',
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src']
    }
  ],
  // Use 'po' format for better git diffs and compatibility with translation tools
  format: 'po',
  // Ensures imports in generated files point to your i18n instance
  runtimeConfigModule: {
    i18n: ['src/i18n', 'i18n'],
    Trans: ['@lingui/react', 'Trans']
  },
  // Sort messages by ID for cleaner diffs
  orderBy: 'messageId'
}

export default config
