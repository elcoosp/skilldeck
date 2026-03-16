// src/types/chat-context.ts
import type { RegistrySkillData, LintWarning } from '@/lib/bindings'

export type ContextItemType = 'skill' | 'file' | 'folder'

export interface AttachedSkill {
  type: 'skill'
  data: RegistrySkillData & { lintWarnings?: LintWarning[] }
}

export interface AttachedFile {
  type: 'file'
  data: {
    id: string // Path
    name: string
    path: string
    size?: number
  }
}

export interface AttachedFolder {
  type: 'folder'
  data: {
    id: string // Path
    name: string
    path: string
    scope: 'shallow' | 'deep'
    fileCount: number
  }
}

export type AttachedItem = AttachedSkill | AttachedFile | AttachedFolder

export interface TriggerState {
  type: 'skill' | 'file'
  query: string
  startIndex: number
}

export interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size?: number
}

export interface FolderCounts {
  shallow: number
  deep: number
}
