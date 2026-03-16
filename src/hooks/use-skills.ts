// src/hooks/use-skills.ts
// React Query hooks for skills — local, registry, and merged views.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import type {
  InstallTarget,
  RegistrySkillData,
  SkillInfo,
} from '@/lib/bindings'
import { toast } from 'sonner'

// ── Local skills ──────────────────────────────────────────────────────────────

export function useLocalSkills() {
  return useQuery({
    queryKey: ['skills', 'local'],
    queryFn: async () => {
      const res = await commands.listSkills()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 30_000
  })
}

// ── Registry skills ───────────────────────────────────────────────────────────

export function useRegistrySkills(params?: {
  category?: string
  search?: string
}) {
  return useQuery({
    queryKey: ['skills', 'registry', params],
    queryFn: async () => {
      const res = await commands.fetchRegistrySkills(
        params?.category ?? null,
        params?.search ?? null
      )
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 5 * 60_000, // 5 min — registry data changes slowly
    retry: 1
  })
}

// ── Merged view ───────────────────────────────────────────────────────────────

export type MergedSkill =
  | (RegistrySkillData & { _sourceType: 'registry' })
  | (SkillInfo & { _sourceType: 'local' })

export function useAllSkills(params?: { category?: string; search?: string }) {
  const localQuery = useQuery({
    queryKey: ['skills', 'local'],
    queryFn: async () => {
      const res = await commands.listSkills()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    }
  })

  const registryQuery = useQuery({
    queryKey: ['skills', 'registry', params],
    queryFn: async () => {
      const res = await commands.fetchRegistrySkills(
        params?.category ?? null,
        params?.search ?? null
      )
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    }
  })

  const combined = (() => {
    const local = (localQuery.data ?? []).map(s => ({ ...s, _sourceType: 'local' as const }))
    const registry = (registryQuery.data ?? []).map(s => ({ ...s, _sourceType: 'registry' as const }))
    return [...local, ...registry]
  })()

  return {
    skills: combined,
    isLoading: localQuery.isLoading || registryQuery.isLoading,
    isError: localQuery.isError || registryQuery.isError,
    refetch: () => {
      localQuery.refetch()
      registryQuery.refetch()
    }
  }
}

// ── Toggle ────────────────────────────────────────────────────────────────────

export function useToggleSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, active }: { name: string; active: boolean }) => {
      const res = await commands.toggleSkill(name, active)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills', 'local'] })
  })
}

// ── Install ───────────────────────────────────────────────────────────────────

export function useInstallSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      skillName,
      skillContent,
      target
    }: {
      skillName: string
      skillContent: string
      target: InstallTarget
    }) => {
      const res = await commands.installSkill(skillName, skillContent, target)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: (result) => {
      toast.success(`Skill "${result.skill_name}" installed successfully`)
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
    onError: (e: unknown) => toast.error(`Install failed: ${e}`)
  })
}

// ── Uninstall ─────────────────────────────────────────────────────────────────

export function useUninstallSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ skillName, target }: { skillName: string; target: InstallTarget }) => {
      const res = await commands.uninstallSkill(skillName, target)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      toast.success('Skill uninstalled')
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
    onError: (e: unknown) => toast.error(`Uninstall failed: ${e}`)
  })
}

// ── Sync ──────────────────────────────────────────────────────────────────────

export function useSyncRegistry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await commands.syncRegistrySkills()
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: (count) => {
      toast.success(`Synced ${count} skill(s) from registry`)
      queryClient.invalidateQueries({ queryKey: ['skills', 'registry'] })
    },
    onError: (e: unknown) => toast.error(`Sync failed: ${e}`)
  })
}

// ── Sources ───────────────────────────────────────────────────────────────────

export function useSkillsSources() {
  return useQuery({
    queryKey: ['skills', 'sources'],
    queryFn: async () => {
      const res = await commands.listSkillSources()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 60_000
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
      toast.success('Skill source added')
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
    onError: (e: unknown) => toast.error(`Failed to add source: ${e}`)
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
      toast.success('Skill source removed')
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
    onError: (e: unknown) => toast.error(`Failed to remove source: ${e}`)
  })
}
