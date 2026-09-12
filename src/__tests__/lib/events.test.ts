import { listen } from '@tauri-apps/api/event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  onAgentEvent,
  onMcpEvent,
  onQueueEvent,
  onSkillEvent,
  onWorkflowEvent
} from '@/lib/events'

const listenMock = vi.mocked(listen)

beforeEach(() => {
  listenMock.mockClear()
})

function emulate<T>(event: string, payload: T) {
  const call = listenMock.mock.calls.find(([channel]) => channel === event)
  if (!call) throw new Error(`no listener registered for ${event}`)
  const handler = call[1]
  handler({ payload } as never)
}

describe('onAgentEvent', () => {
  it('subscribes to agent-event and forwards the payload', async () => {
    const cb = vi.fn()
    const unlisten = await onAgentEvent(cb)
    expect(listenMock).toHaveBeenCalledWith('agent-event', expect.any(Function))
    emulate('agent-event', {
      type: 'token',
      conversation_id: 'c1',
      delta: 'hello'
    })
    expect(cb).toHaveBeenCalledWith({
      type: 'token',
      conversation_id: 'c1',
      delta: 'hello'
    })
    expect(typeof unlisten).toBe('function')
  })
})

describe('onMcpEvent', () => {
  it('subscribes to mcp-event and forwards the payload', async () => {
    const cb = vi.fn()
    await onMcpEvent(cb)
    expect(listenMock).toHaveBeenCalledWith('mcp-event', expect.any(Function))
    emulate('mcp-event', { type: 'tool_discovered', server: 's' })
    expect(cb).toHaveBeenCalledWith({ type: 'tool_discovered', server: 's' })
  })
})

describe('onWorkflowEvent', () => {
  it('subscribes to workflow-event and forwards the payload', async () => {
    const cb = vi.fn()
    await onWorkflowEvent(cb)
    expect(listenMock).toHaveBeenCalledWith(
      'workflow-event',
      expect.any(Function)
    )
    emulate('workflow-event', { type: 'completed' })
    expect(cb).toHaveBeenCalledWith({ type: 'completed' })
  })
})

describe('onSkillEvent', () => {
  it('subscribes to skill-event and forwards the payload', async () => {
    const cb = vi.fn()
    await onSkillEvent(cb)
    expect(listenMock).toHaveBeenCalledWith('skill-event', expect.any(Function))
    emulate('skill-event', {
      type: 'updated',
      source_label: 'Community',
      skill_name: 'demo'
    })
    expect(cb).toHaveBeenCalledWith({
      type: 'updated',
      source_label: 'Community',
      skill_name: 'demo'
    })
  })
})

describe('onQueueEvent', () => {
  it('subscribes to queue-event and forwards the payload', async () => {
    const cb = vi.fn()
    await onQueueEvent(cb)
    expect(listenMock).toHaveBeenCalledWith('queue-event', expect.any(Function))
    emulate('queue-event', {
      type: 'message_sent',
      conversation_id: 'c1',
      message_id: 'm1'
    })
    expect(cb).toHaveBeenCalledWith({
      type: 'message_sent',
      conversation_id: 'c1',
      message_id: 'm1'
    })
  })
})
