import type { LinguiConfig } from '@lingui/conf'
import { formatter } from '@lingui/format-po'

const config: LinguiConfig = {
  locales: ['en'],
  sourceLocale: 'en',
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src/'],
      exclude: ['node_modules', '.next', 'src/locales', 'src/components/ui']
    }
  ],
  format: formatter(),
  compileNamespace: 'cjs'
}

export default config
