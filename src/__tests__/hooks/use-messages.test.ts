import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMessagesWithStream } from '@/hooks/use-messages'
import type { MessageData } from '@/lib/bindings'
import * as bindings from '@/lib/bindings'
import { useUIStore } from '@/store/ui'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const msg = (
  id: string,
  role: MessageData['role'],
  content: string
): MessageData => ({
  id,
  conversation_id: 'conv-1',
  role,
  content,
  created_at: '2024-01-01T00:00:00Z',
  context_items: null // add required field
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
  vi.spyOn(bindings.commands, 'listMessages').mockResolvedValue({
    status: 'ok',
    data: [msg('m1', 'user', 'Hello'), msg('m2', 'assistant', 'Hi there')]
  })

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

    await vi.waitFor(() => {
      expect(result.current.length).toBe(2)
    })
  })

  it('appends synthetic streaming bubble when agent is running', async () => {
    useUIStore.setState({
      streamingText: { 'conv-1': 'Partial response…' },
      agentRunning: { 'conv-1': true }
    })

    const { result } = renderHook(() => useMessagesWithStream('conv-1'), {
      wrapper
    })

    await vi.waitFor(() => {
      expect(result.current.length).toBe(3)
    })

    const streamBubble = result.current.find((m) => m.id === '__streaming__')
    expect(streamBubble).toBeDefined()
    expect(streamBubble?.content).toBe('Partial response…')
    expect(streamBubble?.role).toBe('assistant')
  })

  it('does not append streaming bubble when agent is not running', async () => {
    useUIStore.setState({
      streamingText: {},
      agentRunning: { 'conv-1': false }
    })

    const { result } = renderHook(() => useMessagesWithStream('conv-1'), {
      wrapper
    })

    await vi.waitFor(() => {
      expect(result.current.length).toBe(2)
    })

    const streamBubble = result.current.find((m) => m.id === '__streaming__')
    expect(streamBubble).toBeUndefined()
  })

  it('does not append streaming bubble when streamingText is empty string', async () => {
    useUIStore.setState({
      streamingText: { 'conv-1': '' },
      agentRunning: { 'conv-1': true }
    })

    const { result } = renderHook(() => useMessagesWithStream('conv-1'), {
      wrapper
    })

    await vi.waitFor(() => {
      expect(result.current.length).toBe(2)
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
