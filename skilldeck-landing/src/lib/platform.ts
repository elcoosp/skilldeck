'use client'

// Cached OS detection — module level, computed once
const PLATFORM_DETECTORS = new Map<string, RegExp>([
  ['mac', /Macintosh|MacIntel|MacPPC/],
  ['windows', /Win32|Win64|Windows/],
  ['linux', /Linux|X11/],
])

let cachedPlatform: string | null = null

export function detectPlatform(): string {
  if (cachedPlatform !== null) return cachedPlatform

  if (typeof window === 'undefined') {
    cachedPlatform = 'unknown'
    return cachedPlatform
  }

  const userAgent = navigator.userAgent

  for (const [platform, regex] of PLATFORM_DETECTORS) {
    if (regex.test(userAgent)) {
      cachedPlatform = platform
      return cachedPlatform
    }
  }

  cachedPlatform = 'unknown'
  return cachedPlatform
}

export function getDownloadLabel(): string {
  const platform = detectPlatform()
  const labels: Record<string, string> = {
    mac: 'Download for macOS',
    windows: 'Download for Windows',
    linux: 'Download for Linux',
  }
  return labels[platform] ?? 'Download'
}
