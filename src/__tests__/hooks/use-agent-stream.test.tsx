// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { toast } from '@/components/ui/toast'
import { onAgentEvent } from '@/lib/events'
import { useToolApprovalStore } from '@/store/tool-approvals'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'
import { useUIPersistentStore } from '@/store/ui-state'
import { useAgentStream } from '@/hooks/use-agent-stream'

vi.mock('@/components/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

const commands = vi.hoisted(() => ({
  renameConversation: vi.fn()
}) as Record<string, ReturnType<typeof vi.fn>>)
vi.mock('@/lib/bindings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bindings')>()
  return { ...actual, commands: { ...actual.commands, ...commands } }
})

vi.mock('@/lib/events', () => ({ onAgentEvent: vi.fn() }))

const C = 'aaaaaaaa-0000-1111-2222-333333333333'
const initialUIEphemeral = useUIEphemeralStore.getState()
const initialToolApprovals = useToolApprovalStore.getState().pending
const initialUIPersistent = useUIPersistentStore.getState()

afterEach(() => {
  cleanup()
  useUIEphemeralStore.setState(initialUIEphemeral, true)
  useToolApprovalStore.setState({ pending: initialToolApprovals })
  useUIPersistentStore.setState(initialUIPersistent, true)
})

beforeEach(() => {
  vi.mocked(onAgentEvent).mockClear()
  vi.mocked(toast.error).mockClear()
  for (const fn of Object.values(commands)) fn.mockClear()
  useUIEphemeralStore.setState({
    streamingText: {},
    streamingMessages: {},
    agentRunning: {},
    streamingError: {},
    thinkingDocuments: {}
  })
  useToolApprovalStore.setState({ pending: new Map() })
  useUIPersistentStore.setState({ unlockStage: 0 })
})

describe('useAgentStream', () => {
  let handleEvent: ((event: unknown) => void) | null = null
  const unlisten = vi.fn()

  const capture = (handler: (event: unknown) => void) => {
    handleEvent = handler
    return Promise.resolve(unlisten)
  }

  const client = createTestQueryClient()

  it('filters out events for other conversations', async () => {
    onAgentEvent.mockImplementation(capture)
    renderHook(() => useAgentStream(C), { wrapper: wrapper(client) })
    await waitFor(() => expect(handleEvent).toBeDefined())
    handleEvent!({ type: 'started', conversation_id: 'other' })
    expect(useUIEphemeralStore.getState().agentRunning[C]).toBeUndefined()
  })

  it('resets stream state when the agent starts', async () => {
    onAgentEvent.mockImplementation(capture)
    useUIEphemeralStore.setState({
      agentRunning: { [C]: true },
      streamingError: { [C]: true },
      streamingMessages: { [C]: { stable_nodes: [], draft_nodes: [], toc_items: [], artifact_specs: [] } },
      thinkingDocuments: { [C]: { stable_nodes: [], draft_nodes: [], toc_items: [], artifact_specs: [] } }
    })
    renderHook(() => useAgentStream(C), { wrapper: wrapper(client) })
    await waitFor(() => expect(handleEvent).toBeDefined())
    handleEvent!({ type: 'started', conversation_id: C })
    const state = useUIEphemeralStore.getState()
    expect(state.agentRunning[C]).toBe(true)
    expect(state.streamingError[C]).toBe(false)
    expect(state.streamingMessages[C]).toBeUndefined()
    expect(state.thinkingDocuments[C]).toBeNull()
  })

  it('appends token deltas into the streaming text (buffered flush)', async () => {
    onAgentEvent.mockImplementation(capture)
    renderHook(() => useAgentStream(C), { wrapper: wrapper(client) })
    await waitFor(() => expect(handleEvent).toBeDefined())
    handleEvent!({ type: 'started', conversation_id: C })
    handleEvent!({ type: 'token', conversation_id: C, delta: 'Hello' })
    handleEvent!({ type: 'token', conversation_id: C, delta: ' world' })
    await waitFor(
      () =>
        expect(useUIEphemeralStore.getState().streamingText[C]).toBe(
          'Hello world'
        ),
      { timeout: 1500 }
    )
  })

  it('stabilizes and stores stream updates as a streaming document', async () => {
    onAgentEvent.mockImplementation(capture)
    renderHook(() => useAgentStream(C), { wrapper: wrapper(client) })
    await waitFor(() => expect(handleEvent).toBeDefined())
    const doc = {
      stable_nodes: [{ id: 'n1', type: 'paragraph' }],
      draft_nodes: [{ id: 'd1', html: '<p>x</p>' }],
      toc_items: [],
      artifact_specs: []
    }
    handleEvent!({ type: 'stream_update', conversation_id: C, node_document: doc })
    await waitFor(() =>
      expect(useUIEphemeralStore.getState().streamingMessages[C]).toBeTruthy()
    )
    expect(useUIEphemeralStore.getState().streamingMessages[C]?.draft_nodes).toHaveLength(1)
  })

  it('registers a pending tool approval when required', async () => {
    onAgentEvent.mockImplementation(capture)
    renderHook(() => useAgentStream(C), { wrapper: wrapper(client) })
    await waitFor(() => expect(handleEvent).toBeDefined())
    handleEvent!({
      type: 'tool_approval_required',
      conversation_id: C,
      tool_call_id: 't1',
      tool_name: 'shell',
      arguments: { cmd: 'ls' }
    })
    expect(useToolApprovalStore.getState().pending.get('t1')).toEqual({
      id: 't1',
      name: 'shell',
      arguments: { cmd: 'ls' }
    })
  })

  it('stops running and clears state when done, bumping the unlock stage', async () => {
    onAgentEvent.mockImplementation(capture)
    const refetchSpy = vi.spyOn(client, 'refetchQueries')
    renderHook(() => useAgentStream(C), { wrapper: wrapper(client) })
    await waitFor(() => expect(handleEvent).toBeDefined())
    useUIEphemeralStore.setState({
      agentRunning: { [C]: true },
      streamingText: { [C]: 'stale' }
    })
    handleEvent!({
      type: 'done',
      conversation_id: C,
      message: 'finished'
    })
    const state = useUIEphemeralStore.getState()
    expect(state.agentRunning[C]).toBe(false)
    expect(state.streamingText[C]).toBeUndefined()
    expect(refetchSpy).toHaveBeenCalledWith({
      queryKey: ['queued-messages', C]
    })
    expect(useUIPersistentStore.getState().unlockStage).toBe(1)
  })

  it('flushes, errors, and toasts on an agent error', async () => {
    onAgentEvent.mockImplementation(capture)
    renderHook(() => useAgentStream(C), { wrapper: wrapper(client) })
    await waitFor(() => expect(handleEvent).toBeDefined())
    useUIEphemeralStore.setState({ agentRunning: { [C]: true } })
    handleEvent!({ type: 'error', conversation_id: C, message: 'boom' })
    const state = useUIEphemeralStore.getState()
    expect(state.agentRunning[C]).toBe(false)
    expect(state.streamingError[C]).toBe(true)
    expect(toast.error).toHaveBeenCalledWith('boom')
  })

  it('clears everything on cancellation', async () => {
    onAgentEvent.mockImplementation(capture)
    useToolApprovalStore.setState({
      pending: new Map([['t1', { id: 't1', name: 'x', arguments: {} }]])
    })
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    renderHook(() => useAgentStream(C), { wrapper: wrapper(client) })
    await waitFor(() => expect(handleEvent).toBeDefined())
    useUIEphemeralStore.setState({
      agentRunning: { [C]: true },
      streamingText: { [C]: 'stale' }
    })
    handleEvent!({ type: 'cancelled', conversation_id: C })
    const state = useUIEphemeralStore.getState()
    expect(state.agentRunning[C]).toBe(false)
    expect(state.streamingText[C]).toBeUndefined()
    expect(useToolApprovalStore.getState().pending.size).toBe(0)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['messages', C],
      exact: false
    })
  })

  it('auto-names the conversation when messages persist', async () => {
    onAgentEvent.mockImplementation(capture)
    commands.renameConversation.mockResolvedValue({ status: 'ok', data: null })
    client.setQueryData(['conversations'], [{ id: C, title: null }])
    client.setQueryData(['messages', C], [
      { id: 'm1', role: 'user', content: '  hello world  ' }
    ])
    renderHook(() => useAgentStream(C), { wrapper: wrapper(client) })
    await waitFor(() => expect(handleEvent).toBeDefined())
    handleEvent!({ type: 'persisted', conversation_id: C })
    await waitFor(() =>
      expect(commands.renameConversation).toHaveBeenCalledWith(C, 'Hello world')
    )
  })
})