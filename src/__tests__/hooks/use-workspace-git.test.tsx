// @vitest-environment happy-dom

import { invoke } from '@tauri-apps/api/core'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { useWorkspaceGitStatus } from '@/hooks/use-workspace-git'

afterEach(cleanup)

beforeEach(() => {
  vi.mocked(invoke).mockClear()
})

describe('useWorkspaceGitStatus', () => {
  it('checks git status for the workspace path', async () => {
    vi.mocked(invoke).mockResolvedValue({
      is_git_repo: true,
      has_uncommitted: true
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useWorkspaceGitStatus('/repo'), {
      wrapper: wrapper(client)
    })
    await waitFor(() =>
      expect(result.current.data).toEqual({
        is_git_repo: true,
        has_uncommitted: true
      })
    )
    expect(invoke).toHaveBeenCalledWith('check_git_status', {
      workspacePath: '/repo'
    })
  })

  it('stays idle without a workspace path', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useWorkspaceGitStatus(undefined), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(invoke).not.toHaveBeenCalled()
  })
})
