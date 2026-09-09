import { beforeEach, describe, expect, it } from 'vitest'
import { useUIPersistentStore } from '@/store/ui-state'

const initialState = useUIPersistentStore.getState()

beforeEach(() => {
  useUIPersistentStore.setState(initialState, true)
  localStorage.removeItem('skilldeck-ui-persistent')
  localStorage.removeItem('skilldeck-onboarding-complete')
  localStorage.removeItem('skilldeck-platform-features-enabled')
})

describe('useUIPersistentStore', () => {
  it('defaults to initial persistent values', () => {
    const s = useUIPersistentStore.getState()
    expect(s.unlockStage).toBe(0)
    expect(s.onboardingComplete).toBe(false)
    expect(s.platformFeaturesEnabled).toBe(true)
    expect(s.workspaceExpandedFolders).toEqual({})
  })

  it('setUnlockStage updates the stage', () => {
    useUIPersistentStore.getState().setUnlockStage(3)
    expect(useUIPersistentStore.getState().unlockStage).toBe(3)
  })

  it('setOnboardingComplete writes the dedicated localStorage key', () => {
    useUIPersistentStore.getState().setOnboardingComplete(true)
    expect(useUIPersistentStore.getState().onboardingComplete).toBe(true)
    expect(localStorage.getItem('skilldeck-onboarding-complete')).toBe('true')
  })

  it('setPlatformFeaturesEnabled updates the flag and localStorage', () => {
    useUIPersistentStore.getState().setPlatformFeaturesEnabled(false)
    expect(useUIPersistentStore.getState().platformFeaturesEnabled).toBe(false)
    expect(localStorage.getItem('skilldeck-platform-features-enabled')).toBe(
      'false'
    )
  })

  it('setWorkspaceExpandedFolders replaces per-workspace arrays', () => {
    useUIPersistentStore.getState().setWorkspaceExpandedFolders('ws', ['a'])
    expect(useUIPersistentStore.getState().workspaceExpandedFolders).toEqual({
      ws: ['a']
    })
    useUIPersistentStore.getState().setWorkspaceExpandedFolders('ws', ['a', 'b'])
    expect(useUIPersistentStore.getState().workspaceExpandedFolders).toEqual({
      ws: ['a', 'b']
    })
  })

  it('setWorkspaceExpandedFolders keeps different workspaces separate', () => {
    useUIPersistentStore.getState().setWorkspaceExpandedFolders('ws-1', ['a'])
    useUIPersistentStore.getState().setWorkspaceExpandedFolders('ws-2', ['b'])
    expect(useUIPersistentStore.getState().workspaceExpandedFolders).toEqual({
      'ws-1': ['a'],
      'ws-2': ['b']
    })
  })
})