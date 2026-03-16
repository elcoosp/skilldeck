// src/types/skills.ts
// Unified skill types for the marketplace view.
// These adapt the auto-generated bindings types (SkillInfo, RegistrySkillData)
// into a single merged shape consumed by the UI.

import type { RegistrySkillData, SkillInfo } from '@/lib/bindings'

// Re-export for convenience so hooks/components don't import from bindings directly
export type { RegistrySkillData, SkillInfo }

export type SkillStatus =
  | 'installed' // local + registry, hashes match
  | 'update_available' // local + registry, hashes differ
  | 'available' // registry only
  | 'local_only' // local only, not in registry

export interface UnifiedSkill {
  /** Stable identity: registry id when available, else skill name */
  id: string
  name: string
  description: string
  status: SkillStatus
  localData?: SkillInfo
  registryData?: RegistrySkillData
}
