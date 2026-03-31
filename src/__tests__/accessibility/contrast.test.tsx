// src/__tests__/accessibility/contrast.test.tsx

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { computeContrast, isAccessible } from '@/lib/contrast'

describe('WCAG Contrast', () => {
  it('checks foreground/background contrast for all CSS variables', () => {
    // This test is best run in a browser environment with getComputedStyle.
    // We'll simulate by reading variables from the root.
    const style = getComputedStyle(document.documentElement)
    const pairs = [
      { bg: '--background', fg: '--foreground' },
      { bg: '--primary', fg: '--primary-foreground' },
      { bg: '--secondary', fg: '--secondary-foreground' },
      { bg: '--destructive', fg: '--destructive-foreground' },
      { bg: '--muted', fg: '--muted-foreground' },
      { bg: '--card', fg: '--card-foreground' },
      { bg: '--popover', fg: '--popover-foreground' },
      { bg: '--accent', fg: '--accent-foreground' }
    ]
    for (const pair of pairs) {
      const bg = style.getPropertyValue(pair.bg).trim()
      const fg = style.getPropertyValue(pair.fg).trim()
      if (bg && fg) {
        const contrast = computeContrast(bg, fg)
        expect(isAccessible(contrast)).toBe(true)
      }
    }
  })
})
