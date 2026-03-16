// src/hooks/use-skills.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import type { RegistrySkillData, SkillInfo } from '@/lib/bindings'

export function useAllSkills(options?: { category?: string; search?: string }): {
  skills: Array<SkillInfo | RegistrySkillData>;
  isLoading: boolean;
  isError: boolean;
} {
  const { data: localSkills = [], isLoading: localLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const res = await commands.listSkills()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    }
  })

  const { data: registrySkills = [], isLoading: registryLoading } = useQuery({
    queryKey: ['registry-skills', options?.category, options?.search],
    queryFn: async () => {
      const res = await commands.fetchRegistrySkills(options?.category ?? null, options?.search ?? null)
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    }
  })

  // Combine with type discrimination
  const combined = [
    ...localSkills.map(s => ({ ...s, _sourceType: 'local' as const })),
    ...registrySkills.map(s => ({ ...s, _sourceType: 'registry' as const }))
  ]

  return {
    skills: combined,
    isLoading: localLoading || registryLoading,
    isError: false // TODO: handle errors properly
  }
}

export function useRegistrySkills() {
  return useQuery({
    queryKey: ['registry-skills'],
    queryFn: async () => {
      const res = await commands.fetchRegistrySkills(null, null)
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    }
  })
}

export function useSyncRegistry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await commands.syncRegistrySkills()
      if (res.status === 'error') {
        // Check for platform not configured error
        if (res.error.includes('Platform not configured')) {
          throw new Error('PLATFORM_NOT_CONFIGURED')
        }
        throw new Error(res.error)
      }
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registry-skills'] })
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
    }: {
      skillName: string;
      skillContent: string;
      target: 'personal' | 'workspace';
    }) => {
      const res = await commands.installSkill(skillName, skillContent, target);
      if (res.status === 'error') throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
}

export function useUninstallSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ skillName, target }: { skillName: string; target: 'personal' | 'workspace' }) => {
      const res = await commands.uninstallSkill(skillName, target)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
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
    mutationFn: async ({ sourceType, path, label }: { sourceType: string; path: string; label?: string }) => {
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
