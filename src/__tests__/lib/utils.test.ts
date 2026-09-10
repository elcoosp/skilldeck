import { describe, expect, it } from 'vitest'
import { cn, escapeRegExp, highlightText } from '@/lib/utils'

describe('cn', () => {
  it('joins truthy class values', () => {
    expect(cn('a', 'b', null, undefined, false, '')).toBe('a b')
  })

  it('merges conflicting tailwind classes (last wins)', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })
})

describe('escapeRegExp', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegExp('a.b+c*d?')).toBe('a\\.b\\+c\\*d\\?')
  })

  it('handles empty strings', () => {
    expect(escapeRegExp('')).toBe('')
  })
})

describe('highlightText', () => {
  it('returns text unchanged when query or text is empty', () => {
    expect(highlightText('', 'q')).toBe('')
    expect(highlightText('hello', '')).toBe('hello')
  })

  it('wraps matches in mark tags (case-insensitive)', () => {
    const out = highlightText('Hello hello', 'hello')
    expect(out).toContain('<mark')
    expect(out).toContain('>Hello</mark>')
    expect(out).toContain('>hello</mark>')
  })

  it('respects caseSensitive option', () => {
    const out = highlightText('Hello hello', 'Hello', { caseSensitive: true })
    expect(out.match(/<mark/g)?.length).toBe(1)
  })

  it('treats query as literal by default', () => {
    const out = highlightText('price is a+b', 'a+b')
    expect(out).toContain('>a+b</mark>')
  })

  it('supports isRegex option and wraps captures', () => {
    const out = highlightText('cat 42', '\\d+', { isRegex: true })
    expect(out).toContain('>42</mark>')
  })

  it('falls back to plain text when regex is invalid', () => {
    expect(highlightText('hello', '(', { isRegex: true })).toBe('hello')
  })
})