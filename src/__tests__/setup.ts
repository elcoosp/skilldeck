import { afterAll, beforeAll, beforeEach, vi } from 'vitest'

// ── localStorage polyfill (node environment) ──────────────────────────────────
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear() {
    this.store.clear()
  }
  getItem(key: string) {
    return this.store.get(key) ?? null
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string) {
    this.store.delete(key)
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value))
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    writable: true
  })
}

beforeEach(() => {
  globalThis.localStorage.clear()
})

// ── Mock @tauri-apps/api/core (invoke) ────────────────────────────────────────
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined)
}))

// ── Mock @tauri-apps/api/event (listen / emit) ────────────────────────────────
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined)
}))

// ── Silence React act() warnings in tests ────────────────────────────────────
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: An update to')
    ) {
      return
    }
    originalError(...args)
  }
})

afterAll(() => {
  console.error = originalError
})
