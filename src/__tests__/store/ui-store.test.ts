import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '@/store/ui'

// Reset store between tests using the Zustand setState API
beforeEach(() => {
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

// ── Active conversation ───────────────────────────────────────────────────────

describe('activeConversationId', () => {
  it('starts as null', () => {
    expect(useUIStore.getState().activeConversationId).toBeNull()
  })

  it('setActiveConversation updates the value', () => {
    useUIStore.getState().setActiveConversation('conv-abc')
    expect(useUIStore.getState().activeConversationId).toBe('conv-abc')
  })

  it('setActiveConversation can be set back to null', () => {
    useUIStore.getState().setActiveConversation('conv-abc')
    useUIStore.getState().setActiveConversation(null)
    expect(useUIStore.getState().activeConversationId).toBeNull()
  })
})

// ── Panel sizes ───────────────────────────────────────────────────────────────

describe('panelSizes', () => {
  it('default left is 280', () => {
    expect(useUIStore.getState().panelSizes.left).toBe(280)
  })

  it('default right is 320', () => {
    expect(useUIStore.getState().panelSizes.right).toBe(320)
  })

  it('setPanelSizes merges partial update', () => {
    useUIStore.getState().setPanelSizes({ left: 300 })
    expect(useUIStore.getState().panelSizes.left).toBe(300)
    expect(useUIStore.getState().panelSizes.right).toBe(320)
  })

  it('setPanelSizes can update both sides', () => {
    useUIStore.getState().setPanelSizes({ left: 250, right: 350 })
    const { left, right } = useUIStore.getState().panelSizes
    expect(left).toBe(250)
    expect(right).toBe(350)
  })
})

// ── Drafts ────────────────────────────────────────────────────────────────────

describe('drafts', () => {
  it('setDraft stores content keyed by conversationId', () => {
    useUIStore.getState().setDraft('conv-1', 'hello there')
    expect(useUIStore.getState().drafts['conv-1']).toBe('hello there')
  })

  it('multiple conversations have independent drafts', () => {
    useUIStore.getState().setDraft('conv-a', 'draft A')
    useUIStore.getState().setDraft('conv-b', 'draft B')
    expect(useUIStore.getState().drafts['conv-a']).toBe('draft A')
    expect(useUIStore.getState().drafts['conv-b']).toBe('draft B')
  })

  it('clearDraft removes the entry', () => {
    useUIStore.getState().setDraft('conv-1', 'some text')
    useUIStore.getState().clearDraft('conv-1')
    expect(useUIStore.getState().drafts['conv-1']).toBeUndefined()
  })

  it('clearDraft on unknown id is a no-op', () => {
    expect(() => useUIStore.getState().clearDraft('non-existent')).not.toThrow()
  })
})

// ── Streaming text ────────────────────────────────────────────────────────────

describe('streamingText', () => {
  it('appendStreamingText accumulates deltas', () => {
    const { appendStreamingText } = useUIStore.getState()
    appendStreamingText('conv-1', 'Hello')
    appendStreamingText('conv-1', ', ')
    appendStreamingText('conv-1', 'world!')
    expect(useUIStore.getState().streamingText['conv-1']).toBe('Hello, world!')
  })

  it('clearStreamingText removes entry', () => {
    useUIStore.getState().appendStreamingText('conv-1', 'partial')
    useUIStore.getState().clearStreamingText('conv-1')
    expect(useUIStore.getState().streamingText['conv-1']).toBeUndefined()
  })

  it('streaming text is independent per conversation', () => {
    useUIStore.getState().appendStreamingText('conv-a', 'A')
    useUIStore.getState().appendStreamingText('conv-b', 'B')
    expect(useUIStore.getState().streamingText['conv-a']).toBe('A')
    expect(useUIStore.getState().streamingText['conv-b']).toBe('B')
  })

  it('clearStreamingText on other conversation does not affect this one', () => {
    useUIStore.getState().appendStreamingText('conv-1', 'keep')
    useUIStore.getState().clearStreamingText('conv-other')
    expect(useUIStore.getState().streamingText['conv-1']).toBe('keep')
  })
})

// ── Agent running ─────────────────────────────────────────────────────────────

describe('agentRunning', () => {
  it('defaults to false for unknown conversation', () => {
    expect(useUIStore.getState().agentRunning['conv-x']).toBeUndefined()
  })

  it('setAgentRunning marks conversation as running', () => {
    useUIStore.getState().setAgentRunning('conv-1', true)
    expect(useUIStore.getState().agentRunning['conv-1']).toBe(true)
  })

  it('setAgentRunning can clear running state', () => {
    useUIStore.getState().setAgentRunning('conv-1', true)
    useUIStore.getState().setAgentRunning('conv-1', false)
    expect(useUIStore.getState().agentRunning['conv-1']).toBe(false)
  })
})

// ── Overlays ──────────────────────────────────────────────────────────────────

describe('overlay toggles', () => {
  it('settingsOpen defaults to false', () => {
    expect(useUIStore.getState().settingsOpen).toBe(false)
  })

  it('setSettingsOpen toggles settings panel', () => {
    useUIStore.getState().setSettingsOpen(true)
    expect(useUIStore.getState().settingsOpen).toBe(true)
    useUIStore.getState().setSettingsOpen(false)
    expect(useUIStore.getState().settingsOpen).toBe(false)
  })

  it('commandPaletteOpen defaults to false', () => {
    expect(useUIStore.getState().commandPaletteOpen).toBe(false)
  })

  it('setCommandPaletteOpen toggles palette', () => {
    useUIStore.getState().setCommandPaletteOpen(true)
    expect(useUIStore.getState().commandPaletteOpen).toBe(true)
  })
})

// ── Search ────────────────────────────────────────────────────────────────────

describe('searchQuery', () => {
  it('defaults to empty string', () => {
    expect(useUIStore.getState().searchQuery).toBe('')
  })

  it('setSearchQuery updates value', () => {
    useUIStore.getState().setSearchQuery('my query')
    expect(useUIStore.getState().searchQuery).toBe('my query')
  })
})
