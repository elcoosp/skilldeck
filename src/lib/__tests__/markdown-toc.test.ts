import { describe, expect, it } from 'vitest'
import { extractHeadings } from '../markdown-toc'

describe('extractHeadings', () => {
  it('returns empty array for empty string', () => {
    expect(extractHeadings('')).toEqual([])
  })

  it('returns empty array for markdown without headings', () => {
    const md = 'This is plain text.\n\nAnother paragraph.'
    expect(extractHeadings(md)).toEqual([])
  })

  it('extracts single heading', () => {
    const md = '# Title'
    const headings = extractHeadings(md)
    expect(headings).toHaveLength(1)
    expect(headings[0].level).toBe(1)
    expect(headings[0].text).toBe('Title')
    expect(headings[0].id).toMatch(/^heading-0-title$/)
  })

  it('extracts multiple headings with different levels', () => {
    const md = '# H1\n## H2\n### H3'
    const headings = extractHeadings(md)
    expect(headings).toHaveLength(3)
    expect(headings[0].level).toBe(1)
    expect(headings[0].text).toBe('H1')
    expect(headings[1].level).toBe(2)
    expect(headings[1].text).toBe('H2')
    expect(headings[2].level).toBe(3)
    expect(headings[2].text).toBe('H3')
  })

  it('ignores headings with no text', () => {
    const md = '# \n##'
    expect(extractHeadings(md)).toEqual([])
  })

  it('generates stable IDs', () => {
    const md = '# Hello World!'
    const headings = extractHeadings(md)
    expect(headings[0].id).toBe('heading-0-hello-world')
  })

  it('handles complex headings with formatting', () => {
    const md = '# **Bold** *Italic* `code`'
    const headings = extractHeadings(md)
    expect(headings).toHaveLength(1)
    expect(headings[0].text).toBe('Bold Italic code')
  })
})
