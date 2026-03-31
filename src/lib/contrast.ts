// src/lib/contrast.ts
function parseColor(color: string): { r: number; g: number; b: number } | null {
  color = color.trim().toLowerCase()
  if (color.startsWith('#')) {
    let hex = color.slice(1)
    if (hex.length === 3)
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('')
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      }
    }
    return null
  }
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10)
    }
  }
  const named: Record<string, { r: number; g: number; b: number }> = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 }
  }
  if (named[color]) return named[color]
  return null
}

function luminance(r: number, g: number, b: number): number {
  const rs = r / 255,
    gs = g / 255,
    bs = b / 255
  const rL = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4)
  const gL = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4)
  const bL = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4)
  return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL
}

export function computeContrast(color1: string, color2: string): number {
  const rgb1 = parseColor(color1),
    rgb2 = parseColor(color2)
  if (!rgb1 || !rgb2) throw new Error(`Invalid color: ${color1} or ${color2}`)
  const l1 = luminance(rgb1.r, rgb1.g, rgb1.b)
  const l2 = luminance(rgb2.r, rgb2.g, rgb2.b)
  const lighter = Math.max(l1, l2),
    darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function isAccessible(contrast: number): boolean {
  return contrast >= 4.5
}
