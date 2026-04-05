// src/hooks/use-workspace-git.ts
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'

export interface GitStatus {
  is_git_repo: boolean
  has_uncommitted: boolean
}

export function useWorkspaceGitStatus(workspacePath: string | undefined) {
  return useQuery({
    queryKey: ['git-status', workspacePath],
    queryFn: () => invoke<GitStatus>('check_git_status', { workspacePath }),
    enabled: !!workspacePath,
    staleTime: 60_000, // Check once per minute
    refetchOnWindowFocus: true
  })
}
