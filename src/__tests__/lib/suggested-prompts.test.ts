import { describe, expect, it } from 'vitest'
import { suggestedPrompts } from '@/lib/suggested-prompts'

const categories = [
  'coding',
  'writing',
  'analysis',
  'debugging',
  'planning',
  'brainstorming'
] as const

describe('suggestedPrompts', () => {
  it('gives every entry a non-empty id, label and prompt', () => {
    for (const p of suggestedPrompts) {
      expect(p.id.length).toBeGreaterThan(0)
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.prompt.length).toBeGreaterThan(0)
    }
  })

  it('keeps ids unique', () => {
    const ids = suggestedPrompts.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('uses only known categories', () => {
    for (const p of suggestedPrompts) {
      expect(categories).toContain(p.category)
    }
  })

  it('covers every category with at least one prompt', () => {
    const present = new Set(suggestedPrompts.map((p) => p.category))
    for (const category of categories) {
      expect(present.has(category)).toBe(true)
    }
  })
})