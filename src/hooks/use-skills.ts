// src/hooks/use-skills.ts
// React Query hooks for skills — local, registry, and merged views.

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addSkillSource,
  fetchRegistrySkills,
  installSkill,
  listSkillSources,
  listSkills,
  removeSkillSource,
  syncRegistrySkills,
  toggleSkill,
  uninstallSkill,
  type InstallTarget,
  type RegistrySkill,
  type Skill,
  type SkillSourceInfo
} from '@/lib/invoke'
import { toast } from 'sonner'

// ── Local skills ──────────────────────────────────────────────────────────────

export function useLocalSkills() {
  return useQuery({
    queryKey: ['skills', 'local'],
    queryFn: listSkills,
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
    queryFn: () => fetchRegistrySkills(params),
    staleTime: 5 * 60_000, // 5 min — registry data changes slowly
    retry: 1
  })
}

// ── Merged view ───────────────────────────────────────────────────────────────

export type MergedSkill =
  | (RegistrySkill & { _sourceType: 'registry' })
  | (Skill & { _sourceType: 'local'; id: string })

export function useAllSkills(params?: { category?: string; search?: string }) {
  const localQuery = useQuery({
    queryKey: ['skills', 'local'],
    queryFn: listSkills,
  });

  const registryQuery = useQuery({
    queryKey: ['skills', 'registry', params],
    queryFn: () => fetchRegistrySkills(params),
  });

  const combined = (() => {
    const local = (localQuery.data ?? []).map(s => ({ ...s, _sourceType: 'local' as const }));
    const registry = (registryQuery.data ?? []).map(s => ({ ...s, _sourceType: 'registry' as const }));
    return [...local, ...registry];
  })();

  return {
    skills: combined,
    isLoading: localQuery.isLoading || registryQuery.isLoading,
    isError: localQuery.isError || registryQuery.isError,
    refetch: () => {
      localQuery.refetch();
      registryQuery.refetch();
    },
  };
}

// ── Toggle ────────────────────────────────────────────────────────────────────

export function useToggleSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, active }: { name: string; active: boolean }) =>
      toggleSkill(name, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills', 'local'] })
  })
}

// ── Install ───────────────────────────────────────────────────────────────────

export function useInstallSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      skillName,
      skillContent,
      target
    }: {
      skillName: string
      skillContent: string
      target: InstallTarget
    }) => installSkill(skillName, skillContent, target),
    onSuccess: (result) => {
      toast.success(`Skill "${result.skillName}" installed successfully`)
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
    onError: (e: unknown) => toast.error(`Install failed: ${e}`)
  })
}

// ── Uninstall ─────────────────────────────────────────────────────────────────

export function useUninstallSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ skillName, target }: { skillName: string; target: InstallTarget }) =>
      uninstallSkill(skillName, target),
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
    mutationFn: syncRegistrySkills,
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
    queryFn: listSkillSources,
    staleTime: 60_000
  })
}

export function useAddSkillSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      sourceType,
      path,
      label
    }: {
      sourceType: string
      path: string
      label?: string
    }) => addSkillSource(sourceType, path, label),
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
    mutationFn: (id: string) => removeSkillSource(id),
    onSuccess: () => {
      toast.success('Skill source removed')
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
    onError: (e: unknown) => toast.error(`Failed to remove source: ${e}`)
  })
}
