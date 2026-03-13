import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAgentStream } from '@/hooks/use-agent-stream'
import { useUIStore } from '@/store/ui'
import * as events from '@/lib/events'
import type { AgentEvent } from '@/lib/events'

// ── Setup ─────────────────────────────────────────────────────────────────────

// Capture the callback registered via onAgentEvent so tests can fire it.
let registeredCallback: ((event: AgentEvent) => void) | null = null
let unlistenMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  unlistenMock = vi.fn()
  vi.spyOn(events, 'onAgentEvent').mockImplementation((cb) => {
    registeredCallback = cb
    return Promise.resolve(unlistenMock)
  })

  // Reset store
  useUIStore.setState({
    activeConversationId: null,
    activeBranchId: null,
    panelSizes: { left: 280, right: 320 },
    drafts: {},
    streamingText: {},
    agentRunning: {},
    searchQuery: '',
    settingsOpen: false,
    commandPaletteOpen: false,
    unlockStage: 0
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  registeredCallback = null
})

const fire = (event: AgentEvent) => {
  act(() => {
    registeredCallback?.(event)
  })
}

// ── Subscription ──────────────────────────────────────────────────────────────

describe('useAgentStream subscription', () => {
  it('calls onAgentEvent on mount', () => {
    renderHook(() => useAgentStream('conv-1'))
    expect(events.onAgentEvent).toHaveBeenCalledOnce()
  })

  it('calls unlisten on unmount', async () => {
    const { unmount } = renderHook(() => useAgentStream('conv-1'))
    await act(async () => {}) // let the Promise resolve
    unmount()
    expect(unlistenMock).toHaveBeenCalledOnce()
  })

  it('does not subscribe when conversationId is null', () => {
    renderHook(() => useAgentStream(null))
    expect(events.onAgentEvent).not.toHaveBeenCalled()
  })
})

// ── Event handling ────────────────────────────────────────────────────────────

describe('useAgentStream event handling', () => {
  it('started event sets isRunning to true', async () => {
    const { result } = renderHook(() => useAgentStream('conv-1'))
    await act(async () => {})

    fire({ type: 'started', conversation_id: 'conv-1' })

    expect(result.current.isRunning).toBe(true)
  })

  it('token events accumulate into streamingText', async () => {
    const { result } = renderHook(() => useAgentStream('conv-1'))
    await act(async () => {})

    fire({ type: 'token', conversation_id: 'conv-1', delta: 'Hello' })
    fire({ type: 'token', conversation_id: 'conv-1', delta: ' world' })

    // rAF doesn't run in happy-dom; flush via store directly
    await act(async () => {
      useUIStore.getState().appendStreamingText('conv-1', '')
    })

    const text = useUIStore.getState().streamingText['conv-1'] ?? ''
    expect(text).toContain('Hello')
  })

  it('done event clears isRunning', async () => {
    const { result } = renderHook(() => useAgentStream('conv-1'))
    await act(async () => {})

    fire({ type: 'started', conversation_id: 'conv-1' })
    expect(result.current.isRunning).toBe(true)

    fire({
      type: 'done',
      conversation_id: 'conv-1',
      input_tokens: 10,
      output_tokens: 5
    })
    expect(result.current.isRunning).toBe(false)
  })

  it('error event clears isRunning', async () => {
    const { result } = renderHook(() => useAgentStream('conv-1'))
    await act(async () => {})

    fire({ type: 'started', conversation_id: 'conv-1' })
    fire({ type: 'error', conversation_id: 'conv-1', message: 'API error' })

    expect(result.current.isRunning).toBe(false)
  })

  it('events for other conversations are ignored', async () => {
    const { result } = renderHook(() => useAgentStream('conv-1'))
    await act(async () => {})

    fire({ type: 'started', conversation_id: 'conv-OTHER' })

    expect(result.current.isRunning).toBe(false)
  })

  it('token for other conversation does not appear in this stream', async () => {
    renderHook(() => useAgentStream('conv-1'))
    await act(async () => {})

    fire({ type: 'token', conversation_id: 'conv-OTHER', delta: 'secret' })

    expect(useUIStore.getState().streamingText['conv-1']).toBeUndefined()
  })
})
