import { beforeEach, describe, expect, it } from 'vitest'
import { useSubagentStore } from '@/store/subagent'

const initialState = useSubagentStore.getState()

function seed() {
  useSubagentStore.setState({
    subagents: { sa1: { id: 'sa1', task: 'task-1', status: 'pending' } }
  })
}

beforeEach(() => {
  useSubagentStore.setState(initialState, true)
})

describe('useSubagentStore', () => {
  it('starts empty', () => {
    expect(useSubagentStore.getState().subagents).toEqual({})
  })

  it('updateSubagentStatus preserves the task and other fields', () => {
    seed()
    useSubagentStore.getState().updateSubagentStatus('sa1', 'running')
    expect(useSubagentStore.getState().subagents.sa1).toEqual({
      id: 'sa1',
      task: 'task-1',
      status: 'running'
    })
  })

  it('setSubagentResult sets status completed with the result', () => {
    seed()
    useSubagentStore.getState().setSubagentResult('sa1', 'done')
    expect(useSubagentStore.getState().subagents.sa1).toEqual({
      id: 'sa1',
      task: 'task-1',
      status: 'completed',
      result: 'done'
    })
  })

  it('setSubagentError sets status failed with the error', () => {
    seed()
    useSubagentStore.getState().setSubagentError('sa1', 'boom')
    expect(useSubagentStore.getState().subagents.sa1).toEqual({
      id: 'sa1',
      task: 'task-1',
      status: 'failed',
      error: 'boom'
    })
  })

  it('removeSubagent deletes the entry and keeps others', () => {
    seed()
    useSubagentStore.setState({
      subagents: {
        sa1: { id: 'sa1', task: 'task-1', status: 'pending' },
        sa2: { id: 'sa2', task: 'task-2', status: 'running' }
      }
    })
    useSubagentStore.getState().removeSubagent('sa1')
    expect(useSubagentStore.getState().subagents.sa1).toBeUndefined()
    expect(useSubagentStore.getState().subagents.sa2).toBeDefined()
  })

  it('unknown-id updates create partial entries', () => {
    useSubagentStore.getState().updateSubagentStatus('nope', 'running')
    expect(useSubagentStore.getState().subagents.nope).toEqual({ status: 'running' })
  })
})