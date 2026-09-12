import { beforeEach, describe, expect, it } from 'vitest'
import type { NodeDocument } from '@/lib/bindings'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'

const initialState = useUIEphemeralStore.getState()

const doc: NodeDocument = {
  stable_nodes: [],
  draft_nodes: [],
  toc_items: [],
  artifact_specs: []
}

beforeEach(() => {
  useUIEphemeralStore.setState(initialState, true)
})

describe('useUIEphemeralStore', () => {
  it('defaults to empty collections and null singles', () => {
    const s = useUIEphemeralStore.getState()
    expect(s.drafts).toEqual({})
    expect(s.streamingText).toEqual({})
    expect(s.streamingMessages).toEqual({})
    expect(s.agentRunning).toEqual({})
    expect(s.streamingError).toEqual({})
    expect(s.suggestedPromptsDismissed).toEqual({})
    expect(s.gitInitDismissed).toEqual({})
    expect(s.thinkingDocuments).toEqual({})
    expect(s.conversationSearchQuery).toBe('')
    expect(s.editingMessageId).toBeNull()
    expect(s.selectedArtifactId).toBeNull()
  })

  it('setDraft and clearDraft key by conversation', () => {
    useUIEphemeralStore.getState().setDraft('c1', 'hello')
    useUIEphemeralStore.getState().setDraft('c2', 'world')
    expect(useUIEphemeralStore.getState().drafts).toEqual({
      c1: 'hello',
      c2: 'world'
    })
    useUIEphemeralStore.getState().clearDraft('c1')
    expect(useUIEphemeralStore.getState().drafts).toEqual({ c2: 'world' })
  })

  it('appendStreamingText accumulates deltas per conversation', () => {
    useUIEphemeralStore.getState().appendStreamingText('c1', 'Hel')
    useUIEphemeralStore.getState().appendStreamingText('c1', 'lo')
    useUIEphemeralStore.getState().appendStreamingText('c2', 'X')
    expect(useUIEphemeralStore.getState().streamingText).toEqual({
      c1: 'Hello',
      c2: 'X'
    })
    useUIEphemeralStore.getState().clearStreamingText('c1')
    expect(useUIEphemeralStore.getState().streamingText).toEqual({ c2: 'X' })
  })

  it('setStreamingMessage stores non-null docs', () => {
    useUIEphemeralStore.getState().setStreamingMessage('c1', doc)
    expect(useUIEphemeralStore.getState().streamingMessages.c1).toBe(doc)
  })

  it('setStreamingMessage removes the key for null', () => {
    useUIEphemeralStore.getState().setStreamingMessage('c1', doc)
    useUIEphemeralStore.getState().setStreamingMessage('c1', null)
    expect(useUIEphemeralStore.getState().streamingMessages.c1).toBeUndefined()
  })

  it('setAgentRunning and setStreamingError key by conversation', () => {
    useUIEphemeralStore.getState().setAgentRunning('c1', true)
    useUIEphemeralStore.getState().setStreamingError('c1', true)
    expect(useUIEphemeralStore.getState().agentRunning.c1).toBe(true)
    expect(useUIEphemeralStore.getState().streamingError.c1).toBe(true)
  })

  it('setConversationSearchQuery updates the query', () => {
    useUIEphemeralStore.getState().setConversationSearchQuery('skilldeck')
    expect(useUIEphemeralStore.getState().conversationSearchQuery).toBe(
      'skilldeck'
    )
  })

  it('dismissal flags key by id', () => {
    useUIEphemeralStore.getState().setSuggestedPromptsDismissed('p1', true)
    useUIEphemeralStore.getState().setGitInitDismissed('/repo', true)
    expect(useUIEphemeralStore.getState().suggestedPromptsDismissed).toEqual({
      p1: true
    })
    expect(useUIEphemeralStore.getState().gitInitDismissed).toEqual({
      '/repo': true
    })
  })

  it('setEditingMessageId and setSelectedArtifactId update singles', () => {
    useUIEphemeralStore.getState().setEditingMessageId('m9')
    useUIEphemeralStore.getState().setSelectedArtifactId('a1')
    expect(useUIEphemeralStore.getState().editingMessageId).toBe('m9')
    expect(useUIEphemeralStore.getState().selectedArtifactId).toBe('a1')
  })

  it('setThinkingDocument stores and later nulls the doc', () => {
    useUIEphemeralStore.getState().setThinkingDocument('c1', doc)
    expect(useUIEphemeralStore.getState().thinkingDocuments.c1).toBe(doc)
    useUIEphemeralStore.getState().setThinkingDocument('c1', null)
    expect(useUIEphemeralStore.getState().thinkingDocuments.c1).toBeNull()
  })
})
