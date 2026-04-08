import type { ABTestConfig } from '@/types/ab-test'

export const AB_TESTS: Record<string, ABTestConfig> = {
  hero: {
    name: 'Hero Headline',
    description:
      'Test problem-focused vs outcome-focused hero headline and benefit language',
    variants: [
      { key: 'problem', name: 'Problem-focused (pain point)', traffic: 50 },
      { key: 'outcome', name: 'Outcome-focused (what you get)', traffic: 50 }
    ],
    startDate: '2026-04-05'
  },
  hero_cta: {
    name: 'Hero CTA Copy',
    description: 'Test platform-specific download vs generic value CTA',
    variants: [
      {
        key: 'platform',
        name: 'Platform-specific (Download for macOS)',
        traffic: 50
      },
      { key: 'value', name: 'Value-focused (Get SkillDeck Free)', traffic: 50 }
    ],
    startDate: '2026-04-05'
  },
  belt_heading: {
    name: 'Feature Belt Heading',
    description: 'Test generic vs specific feature section heading',
    variants: [
      {
        key: 'specific',
        name: 'One app replaces your AI toolchain',
        traffic: 50
      },
      {
        key: 'generic',
        name: 'Everything you need for AI orchestration',
        traffic: 50
      }
    ],
    startDate: '2026-04-05'
  },
  comparison_heading: {
    name: 'Comparison Section Heading',
    description: 'Test generic vs persuasive comparison heading',
    variants: [
      {
        key: 'persuasive',
        name: 'Why developers are switching to SkillDeck',
        traffic: 50
      },
      { key: 'generic', name: 'How SkillDeck compares', traffic: 50 }
    ],
    startDate: '2026-04-05'
  }
}
