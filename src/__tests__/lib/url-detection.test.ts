import { describe, expect, it } from 'vitest'
import { extractUrls } from '@/lib/url-detection'

describe('extractUrls', () => {
  it('extracts a single URL', () => {
    expect(extractUrls('see https://example.com now')).toEqual([
      'https://example.com'
    ])
  })

  it('extracts multiple URLs', () => {
    expect(
      extractUrls('a https://one.com b http://two.org c https://three.net')
    ).toEqual(['https://one.com', 'http://two.org', 'https://three.net'])
  })

  it('extracts URLs with query and hash', () => {
    expect(extractUrls('https://example.com/path?a=1&b=2#section')).toEqual([
      'https://example.com/path?a=1&b=2#section'
    ])
  })

  it('includes trailing punctuation (regex char class does not strip commas)', () => {
    expect(extractUrls('Visit https://example.com, then')).toEqual([
      'https://example.com,'
    ])
  })

  it('returns an empty array when there are no URLs', () => {
    expect(extractUrls('just plain words')).toEqual([])
    expect(extractUrls('')).toEqual([])
  })

  it('ignores ftp:// URLs', () => {
    expect(extractUrls('ftp://example.com/file')).toEqual([])
  })
})