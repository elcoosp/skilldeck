import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkspaceStore } from '@/store/workspace'

const initialState = useWorkspaceStore.getState()

beforeEach(() => {
  useWorkspaceStore.setState(initialState, true)
})

describe('useWorkspaceStore', () => {
  it('defaults to null workspace id', () => {
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBeNull()
  })

  it('setActiveWorkspace updates the id', () => {
    useWorkspaceStore.getState().setActiveWorkspace('ws-1')
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('ws-1')
  })

  it('setActiveWorkspace accepts null', () => {
    useWorkspaceStore.getState().setActiveWorkspace('ws-1')
    useWorkspaceStore.getState().setActiveWorkspace(null)
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBeNull()
  })
})