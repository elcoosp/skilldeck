import { afterAll, beforeAll, vi } from 'vitest'

// ── Mock @tauri-apps/api/core (invoke) ────────────────────────────────────────
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined)
}))

// ── Mock @tauri-apps/api/event (listen / emit) ────────────────────────────────
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => { }),
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
