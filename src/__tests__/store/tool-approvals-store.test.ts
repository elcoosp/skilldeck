import { beforeEach, describe, expect, it } from 'vitest'
import type { ToolCallInfo } from '@/lib/events'
import { useToolApprovalStore } from '@/store/tool-approvals'

const info: ToolCallInfo = {
  id: 'tc-1',
  name: 'read_file',
  arguments: { path: '/tmp/a.txt' }
}

beforeEach(() => {
  useToolApprovalStore.setState({ pending: new Map() })
})

describe('useToolApprovalStore', () => {
  it('starts empty', () => {
    expect(useToolApprovalStore.getState().pending.size).toBe(0)
  })

  it('addPending stores by toolCallId', () => {
    useToolApprovalStore.getState().addPending('x-1', info)
    const p = useToolApprovalStore.getState().pending
    expect(p.get('x-1')).toBe(info)
  })

  it('addPending does not mutate the previous map', () => {
    const s = useToolApprovalStore.getState()
    const before = s.pending
    s.addPending('x-1', info)
    expect(before).not.toBe(useToolApprovalStore.getState().pending)
    expect(before.size).toBe(0)
  })

  it('removePending deletes a single entry', () => {
    useToolApprovalStore.getState().addPending('x-1', info)
    useToolApprovalStore.getState().addPending('x-2', info)
    useToolApprovalStore.getState().removePending('x-1')
    const p = useToolApprovalStore.getState().pending
    expect(p.has('x-1')).toBe(false)
    expect(p.has('x-2')).toBe(true)
  })

  it('clearAll empties the map', () => {
    useToolApprovalStore.getState().addPending('x-1', info)
    useToolApprovalStore.getState().clearAll()
    expect(useToolApprovalStore.getState().pending.size).toBe(0)
  })
})
