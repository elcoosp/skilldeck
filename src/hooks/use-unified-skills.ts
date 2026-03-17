// src/hooks/use-unified-skills.ts
// Merges local skills (from Tauri registry) and remote registry skills
// (from the platform cache) into a single sorted UnifiedSkill[].

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import type { RegistrySkillData, SkillInfo } from '@/lib/bindings'
import type { SkillStatus, UnifiedSkill } from '@/types/skills'
import { keepPreviousData } from '@tanstack/react-query'

// ── Data fetchers ─────────────────────────────────────────────────────────────

function useLocalSkills() {
  return useQuery<SkillInfo[]>({
    queryKey: ['local_skills'],
    queryFn: async () => {
      const res = await commands.listSkills()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 30_000
  })
}

function useRegistrySkills(search?: string) {
  return useQuery<RegistrySkillData[]>({
    queryKey: ['registry_skills', search ?? null],
    queryFn: async () => {
      const res = await commands.fetchRegistrySkills(null, search ?? null)
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    placeholderData: keepPreviousData, // <-- added
    retry: false,
    staleTime: 60_000
  })
}

// ── Status order helper ───────────────────────────────────────────────────────

function statusOrder(s: SkillStatus): number {
  if (s === 'installed' || s === 'local_only') return 0
  if (s === 'update_available') return 1
  return 2
}

// ── Public hook ───────────────────────────────────────────────────────────────

export interface UseUnifiedSkillsOptions {
  search?: string
}

export function useUnifiedSkills(options: UseUnifiedSkillsOptions = {}) {
  const { search } = options

  const {
    data: localSkills = [],
    isLoading: loadingLocal,
    error: localError
  } = useLocalSkills()

  const {
    data: registrySkills = [],
    isLoading: loadingRegistry,
    error: registryError
  } = useRegistrySkills(search)

  const isLoading = loadingLocal || loadingRegistry

  const unifiedSkills = useMemo<UnifiedSkill[]>(() => {
    const map = new Map<string, UnifiedSkill>()

    // 1. Base layer — all registry skills default to "available"
    for (const reg of registrySkills) {
      map.set(reg.name, {
        id: reg.id,
        name: reg.name,
        description: reg.description,
        status: 'available',
        registryData: reg
      })
    }

    // 2. Overlay layer — local skills override registry status
    for (const local of localSkills) {
      const existing = map.get(local.name)

      if (existing?.registryData) {
        // Present in both: compare content hash to detect stale installs.
        // SkillInfo doesn't carry a hash but RegistrySkillData has `content`.
        // We use source field as a heuristic: if source is "registry" the
        // backend already synced it; treat it as installed unless the registry
        // version is newer (detected by the skill being present without
        // "registry" source).
        const isRegistry = local.source === 'registry'
        const status: SkillStatus = isRegistry ? 'installed' : 'update_available'

        map.set(local.name, {
          ...existing,
          status,
          localData: local
        })
      } else {
        // Only exists locally
        map.set(local.name, {
          id: local.name,
          name: local.name,
          description: local.description,
          status: 'local_only',
          localData: local
        })
      }
    }

    // 3. Apply client-side search filter when registry is offline
    const filtered =
      search && registrySkills.length === 0
        ? Array.from(map.values()).filter(
          (s) =>
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.description.toLowerCase().includes(search.toLowerCase())
        )
        : Array.from(map.values())

    // 4. Sort: installed/local first, then update_available, then available;
    //    within each group sort alphabetically.
    return filtered.sort((a, b) => {
      const diff = statusOrder(a.status) - statusOrder(b.status)
      return diff !== 0 ? diff : a.name.localeCompare(b.name)
    })
  }, [localSkills, registrySkills, search])

  const installedCount = unifiedSkills.filter(
    (s) => s.status === 'installed' || s.status === 'local_only'
  ).length

  return {
    unifiedSkills,
    isLoading,
    localError,
    registryError,
    installedCount
  }
}
