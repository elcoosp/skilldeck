// src/lib/scroll-token.ts
import type { ScrollToken } from '@/components/conversation/message-thread'

const memoryCache = new Map<string, ScrollToken>()

export function getScrollToken(key: string): ScrollToken | null {
  const inMemory = memoryCache.get(key)
  if (inMemory) return inMemory
  try {
    const raw = sessionStorage.getItem(`scroll:${key}`)
    if (raw) {
      const token = JSON.parse(raw) as ScrollToken
      memoryCache.set(key, token)
      return token
    }
  } catch {}
  return null
}

export function setScrollToken(key: string, token: ScrollToken) {
  memoryCache.set(key, token)
  try {
    sessionStorage.setItem(`scroll:${key}`, JSON.stringify(token))
  } catch {}
}

export function clearScrollToken(key: string) {
  memoryCache.delete(key)
  try {
    sessionStorage.removeItem(`scroll:${key}`)
  } catch {}
}
