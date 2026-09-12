import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS } from '@/lib/achievements'

describe('ACHIEVEMENTS', () => {
  it('has the four expected achievements with full metadata', () => {
    expect(ACHIEVEMENTS).toMatchObject({
      firstMessage: { id: 'first-message', title: 'First Words' },
      tenthMessage: { id: 'tenth-message', title: 'Getting Chatty' },
      firstToolApproval: { id: 'first-tool', title: 'Tool Master' },
      fiveTools: { id: 'five-tools', title: 'Power User' }
    })
  })

  it('gives every achievement an id, emoji, title and description', () => {
    for (const entry of Object.values(ACHIEVEMENTS)) {
      expect(entry.id).toBeTruthy()
      expect(entry.emoji).toBeTruthy()
      expect(entry.title).toBeTruthy()
      expect(entry.description).toBeTruthy()
    }
  })

  it('keeps ids unique', () => {
    const ids = Object.values(ACHIEVEMENTS).map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
