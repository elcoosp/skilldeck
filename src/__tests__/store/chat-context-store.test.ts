import { beforeEach, describe, expect, it } from 'vitest'
import type { LintWarning, RegistrySkillData } from '@/lib/bindings'
import { useChatContextStore } from '@/store/chat-context-store'

const initialState = useChatContextStore.getState()

function makeSkill(id: string): RegistrySkillData {
  return {
    id,
    name: `skill-${id}`,
    description: 'desc',
    source: 'registry',
    sourceUrl: null,
    version: '1.0.0',
    author: 'auth',
    license: 'MIT',
    tags: ['tag'],
    category: 'test',
    lintWarnings: [],
    securityScore: 1,
    qualityScore: 1,
    metadataSource: 'test',
    content: 'content',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  }
}

beforeEach(() => {
  useChatContextStore.setState(initialState, true)
})

describe('useChatContextStore', () => {
  it('starts with no items', () => {
    expect(useChatContextStore.getState().items).toEqual({})
  })

  it('addSkill appends and strips lintWarnings', () => {
    useChatContextStore.getState().addSkill('c1', makeSkill('s1'))
    const items = useChatContextStore.getState().items.c1
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('skill')
    expect(items[0].data.id).toBe('s1')
    expect(items[0].data.lintWarnings).toBeUndefined()
  })

  it('addSkill dedupes by id', () => {
    useChatContextStore.getState().addSkill('c1', makeSkill('s1'))
    useChatContextStore.getState().addSkill('c1', makeSkill('s1'))
    expect(useChatContextStore.getState().items.c1).toHaveLength(1)
  })

  it('addFile appends, dedupes, and keeps the file discriminant', () => {
    const file = { id: 'f1', name: 'a.rs', path: '/a.rs', size: 10 }
    useChatContextStore.getState().addFile('c1', file)
    useChatContextStore.getState().addFile('c1', file)
    const items = useChatContextStore.getState().items.c1
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('file')
    expect(items[0].data).toEqual(file)
  })

  it('addFolder appends, dedupes, and keeps the folder discriminant', () => {
    const folder = {
      id: 'd1',
      name: 'src',
      path: '/src',
      scope: 'shallow',
      fileCount: 3
    }
    useChatContextStore.getState().addFolder('c1', folder)
    useChatContextStore.getState().addFolder('c1', folder)
    const items = useChatContextStore.getState().items.c1
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('folder')
    expect(items[0].data).toEqual(folder)
  })

  it('removeItem filters by data.id across types', () => {
    useChatContextStore.getState().addSkill('c1', makeSkill('s1'))
    useChatContextStore.getState().addFile('c1', {
      id: 'f1',
      name: 'a.rs',
      path: '/a.rs'
    })
    useChatContextStore.getState().addFolder('c1', {
      id: 'd1',
      name: 'src',
      path: '/src',
      scope: 'shallow',
      fileCount: 3
    })
    useChatContextStore.getState().removeItem('c1', 'f1')
    const ids = useChatContextStore.getState().items.c1.map((i) => i.data.id)
    expect(ids).toEqual(['s1', 'd1'])
  })

  it('clearItems removes only the given conversation', () => {
    useChatContextStore.getState().addSkill('c1', makeSkill('s1'))
    useChatContextStore.getState().addSkill('c2', makeSkill('s2'))
    useChatContextStore.getState().clearItems('c1')
    expect(useChatContextStore.getState().items.c1).toBeUndefined()
    expect(useChatContextStore.getState().items.c2).toHaveLength(1)
  })

  it('updateSkillLintResults patches only the matching skill', () => {
    useChatContextStore.getState().addSkill('c1', makeSkill('s1'))
    useChatContextStore.getState().addFile('c1', {
      id: 'f1',
      name: 'a.rs',
      path: '/a.rs'
    })
    const warnings: LintWarning[] = [
      {
        rule_id: 'no-unused',
        severity: 'warning',
        message: 'unused var',
        location: null,
        suggested_fix: null
      }
    ]
    useChatContextStore.getState().updateSkillLintResults('c1', 's1', warnings)
    const items = useChatContextStore.getState().items.c1
    const skill = items.find((i) => i.type === 'skill')
    expect(skill?.data.lintWarnings).toEqual(warnings)
    const file = items.find((i) => i.type === 'file')
    expect('lintWarnings' in (file?.data ?? {})).toBe(false)
  })

  it('updateSkillLintResults does not touch other conversations', () => {
    useChatContextStore.getState().addSkill('c1', makeSkill('s1'))
    useChatContextStore.getState().addSkill('c2', makeSkill('s2'))
    const warning: LintWarning = {
      rule_id: 'r',
      severity: 'warning',
      message: 'm',
      location: null,
      suggested_fix: null
    }
    useChatContextStore.getState().updateSkillLintResults('c1', 's1', [warning])
    const c2 = useChatContextStore.getState().items.c2[0]
    expect(c2.type === 'skill' && c2.data.lintWarnings).toBeUndefined()
  })
})
