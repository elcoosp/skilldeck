import { describe, expect, it } from 'vitest'
import { DOCS_LINT_URL, PLATFORM_BASE_URL, platformUrl } from '@/lib/config'

describe('config', () => {
  it('platformUrl builds on PLATFORM_BASE_URL', () => {
    expect(platformUrl('/api/x')).toBe(`${PLATFORM_BASE_URL}/api/x`)
  })

  it('DOCS_LINT_URL is an https URL', () => {
    expect(DOCS_LINT_URL.startsWith('https://')).toBe(true)
  })
})
