import { describe, expect, it } from 'vitest'
import { computeContrast, isAccessible } from '@/lib/contrast'

describe('computeContrast', () => {
  it('computes the maximum ratio for white on black', () => {
    expect(computeContrast('#ffffff', '#000000')).toBeCloseTo(21, 0)
  })

  it('accepts named colors', () => {
    expect(computeContrast('white', 'black')).toBeCloseTo(21, 0)
  })

  it('expands 3-digit hex colors', () => {
    expect(computeContrast('#fff', '#000')).toBeCloseTo(21, 0)
  })

  it('returns 1 for identical colors', () => {
    expect(computeContrast('#000000', '#000000')).toBe(1)
  })

  it('parses rgb() colors', () => {
    expect(computeContrast('rgb(0,0,0)', 'rgb(255, 255, 255)')).toBeCloseTo(21, 0)
  })

  it('throws for invalid colors', () => {
    expect(() => computeContrast('not-a-color', '#000000')).toThrow(
      /Invalid color/
    )
    expect(() => computeContrast('#12', '#000000')).toThrow(/Invalid color/)
  })

  it('is symmetric', () => {
    expect(computeContrast('#ffffff', '#000000')).toBe(
      computeContrast('#000000', '#ffffff')
    )
  })
})

describe('isAccessible', () => {
  it('is accessible at or above 4.5', () => {
    expect(isAccessible(4.5)).toBe(true)
    expect(isAccessible(21)).toBe(true)
  })

  it('is not accessible below 4.5', () => {
    expect(isAccessible(2.9)).toBe(false)
  })
})