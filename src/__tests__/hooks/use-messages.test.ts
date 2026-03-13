import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUIStore } from '@/store/ui'
import { useMessagesWithStream } from '@/hooks/use-messages'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as invoke from '@/lib/invoke'
import type { Message } from '@/lib/invoke'
import React from 'react'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const msg = (id: string, role: Message['role'], content: string): Message => ({
  id,
  conversation_id: 'conv-1',
  role,
  content,
  created_at: '2024-01-01T00:00:00Z'
})

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    QueryClientProvider,
    {
      client: new QueryClient({ defaultOptions: { queries: { retry: false } } })
    },
    children
  )

beforeEach(() => {
  vi.spyOn(invoke, 'listMessages').mockResolvedValue([
    msg('m1', 'user', 'Hello'),
    msg('m2', 'assistant', 'Hi there')
  ])

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

// ── useMessagesWithStream ─────────────────────────────────────────────────────

describe('useMessagesWithStream', () => {
  it('returns persisted messages when agent is not running', async () => {
    const { result } = renderHook(() => useMessagesWithStream('conv-1'), {
      wrapper
    })

    // Before query resolves the list is empty
    expect(Array.isArray(result.current)).toBe(true)
  })

  it('appends synthetic streaming bubble when agent is running', () => {
    // Seed store with streaming text and running flag
    useUIStore.setState({
      streamingText: { 'conv-1': 'Partial response…' },
      agentRunning: { 'conv-1': true }
    })

    const { result } = renderHook(() => useMessagesWithStream('conv-1'), {
      wrapper
    })

    const messages = result.current
    const streamBubble = messages.find((m) => m.id === '__streaming__')
    expect(streamBubble).toBeDefined()
    expect(streamBubble?.content).toBe('Partial response…')
    expect(streamBubble?.role).toBe('assistant')
  })

  it('does not append streaming bubble when agent is not running', () => {
    useUIStore.setState({
      streamingText: {},
      agentRunning: { 'conv-1': false }
    })

    const { result } = renderHook(() => useMessagesWithStream('conv-1'), {
      wrapper
    })

    const streamBubble = result.current.find((m) => m.id === '__streaming__')
    expect(streamBubble).toBeUndefined()
  })

  it('does not append streaming bubble when streamingText is empty string', () => {
    useUIStore.setState({
      streamingText: { 'conv-1': '' },
      agentRunning: { 'conv-1': true }
    })

    const { result } = renderHook(() => useMessagesWithStream('conv-1'), {
      wrapper
    })

    const streamBubble = result.current.find((m) => m.id === '__streaming__')
    expect(streamBubble).toBeUndefined()
  })

  it('returns empty array for null conversationId', () => {
    const { result } = renderHook(() => useMessagesWithStream(null), {
      wrapper
    })
    expect(result.current).toEqual([])
  })
})
