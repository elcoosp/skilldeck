// src/hooks/use-skills.ts
// Mutations and skill-related operations (install, uninstall, sync, diff, disable rule, source management).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'

export function useSyncRegistry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await commands.syncRegistrySkills()
      if (res.status === 'error') {
        if (res.error.includes('Platform not configured')) {
          throw new Error('PLATFORM_NOT_CONFIGURED')
        }
        throw new Error(res.error)
      }
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registry_skills'] })
    }
  })
}

export function useInstallSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      skillName,
      skillContent,
      target,
      overwrite
    }: {
      skillName: string
      skillContent: string
      target: 'personal' | 'workspace'
      overwrite?: boolean
    }) => {
      const res = await commands.installSkill(
        skillName,
        skillContent,
        target,
        overwrite ?? null
      )
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      queryClient.invalidateQueries({ queryKey: ['local_skills'] })
    }
  })
}

export function useUninstallSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      skillName,
      target
    }: {
      skillName: string
      target: 'personal' | 'workspace'
    }) => {
      const res = await commands.uninstallSkill(skillName, target)
      if (res.status === 'error') throw new Error(res.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      queryClient.invalidateQueries({ queryKey: ['local_skills'] })
    }
  })
}

export function useDiffSkillVersions() {
  return useMutation({
    mutationFn: async ({
      localPath,
      registryContent
    }: {
      localPath: string
      registryContent: string
    }) => {
      const res = await commands.diffSkillVersions(localPath, registryContent)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    }
  })
}

export function useDisableRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ruleId,
      scope
    }: {
      ruleId: string
      scope: 'global' | 'workspace'
    }) => {
      const res = await commands.disableLintRule(ruleId, scope)
      if (res.status === 'error') throw new Error(res.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lint-rules'] })
    }
  })
}

export function useSkillsSources() {
  return useQuery({
    queryKey: ['skill-sources'],
    queryFn: async () => {
      const res = await commands.listSkillSources()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    }
  })
}

export function useAddSkillSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      sourceType,
      path,
      label
    }: {
      sourceType: string
      path: string
      label?: string
    }) => {
      const res = await commands.addSkillSource(sourceType, path, label ?? null)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-sources'] })
    }
  })
}

export function useRemoveSkillSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await commands.removeSkillSource(id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-sources'] })
    }
  })
}
