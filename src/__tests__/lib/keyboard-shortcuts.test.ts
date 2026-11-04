import { describe, expect, it } from 'vitest'
import { keyboardShortcuts } from '@/lib/keyboard-shortcuts'

const categories = ['navigation', 'conversation', 'editing', 'app'] as const

describe('keyboardShortcuts', () => {
  it('exposes 10 entries', () => {
    expect(keyboardShortcuts).toHaveLength(10)
  })

  it('has unique key strings', () => {
    const keys = keyboardShortcuts.map((s) => s.keys)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('uses only known categories', () => {
    for (const s of keyboardShortcuts) {
      expect(categories).toContain(s.category)
    }
  })

  it('includes the headline shortcuts', () => {
    const keys = keyboardShortcuts.map((s) => s.keys)
    expect(keys).toContain('Cmd+K')
    expect(keys).toContain('Cmd+Enter')
  })

  it('has descriptions for every shortcut', () => {
    for (const s of keyboardShortcuts) {
      expect(s.description.length).toBeGreaterThan(0)
    }
  })
})
