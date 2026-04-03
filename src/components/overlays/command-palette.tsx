// src/components/overlays/command-palette.tsx
/**
 * CommandPalette — global ⌘K overlay powered by cmdk.
 *
 * Groups:
 *   • Conversations — fuzzy-search recent conversations
 *   • Skills        — toggle or inspect loaded skills
 *   • Actions       — new chat, open workspace, settings
 */

import { Command } from 'cmdk'
import { FolderOpen, Layers, MessageSquare, Plus, Settings } from 'lucide-react'
import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  useConversations,
  useCreateConversation
} from '@/hooks/use-conversations'
import { useProfiles } from '@/hooks/use-profiles'
import { useUnifiedSkills } from '@/hooks/use-unified-skills'
import { useConversationStore } from '@/store/conversation'
import { useUIOverlaysStore } from '@/store/ui-overlays'

export function CommandPalette() {
  const router = useRouter()
  const open = useUIOverlaysStore((s) => s.commandPaletteOpen)
  const setOpen = useUIOverlaysStore((s) => s.setCommandPaletteOpen)
  const setActiveConversation = useConversationStore(
    (s) => s.setActiveConversation
  )

  const { data: conversations = [] } = useConversations()
  const { unifiedSkills } = useUnifiedSkills()
  const { data: profiles = [] } = useProfiles()

  const defaultProfile = profiles.find((p) => p.is_default) ?? profiles[0]
  const createConversation = useCreateConversation(defaultProfile?.id)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, setOpen])

  if (!open) return null

  return (
    /* Backdrop – softer, matches brand neutral */
    <button
      className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-start justify-center pt-[15vh] cursor-default"
      onClick={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setOpen(false)
        }
      }}
      aria-label="Close command palette"
      type="button"
    >
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-full max-w-xl mx-4 rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
      >
        <Command className="[&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-border">
          <Command.Input
            autoFocus
            placeholder="Search conversations, skills, actions… (⌘K)"
            className="w-full bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />

          <Command.List className="max-h-[400px] overflow-y-auto p-1.5 space-y-0.5">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Actions */}
            <Command.Group
              heading="Actions"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              <CommandItem
                icon={<Plus className="size-4" />}
                label="New Chat"
                onSelect={() => {
                  if (defaultProfile) {
                    createConversation.mutate({})
                  }
                  setOpen(false)
                }}
              />
              <CommandItem
                icon={<Settings className="size-4" />}
                label="Settings"
                shortcut="⌘,"
                onSelect={() => {
                  console.log('Command palette: navigating to settings')
                  setOpen(false)
                  router.navigate({ to: '/settings/api-keys' })
                }}
              />
              <CommandItem
                icon={<FolderOpen className="size-4" />}
                label="Open Workspace"
                onSelect={() => setOpen(false)}
              />
            </Command.Group>

            {/* Conversations */}
            {conversations.length > 0 && (
              <Command.Group
                heading="Conversations"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {conversations.slice(0, 8).map((c) => (
                  <CommandItem
                    key={c.id}
                    icon={<MessageSquare className="size-4" />}
                    label={c.title ?? 'Untitled'}
                    sublabel={`${c.message_count} messages`}
                    onSelect={() => {
                      setActiveConversation(c.id)
                      setOpen(false)
                    }}
                  />
                ))}
              </Command.Group>
            )}

            {/* Skills */}
            {unifiedSkills.length > 0 && (
              <Command.Group
                heading="Skills"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {unifiedSkills.slice(0, 6).map((skill) => (
                  <CommandItem
                    key={skill.name}
                    icon={<Layers className="size-4" />}
                    label={skill.name}
                    sublabel={skill.description}
                    onSelect={() => setOpen(false)}
                  />
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </button>
  )
}

// ── Internal helper with brand‑consistent styling ───────────────────────────

interface CommandItemProps {
  icon: React.ReactNode
  label: string
  sublabel?: string
  shortcut?: string
  onSelect: () => void
}

function CommandItem({
  icon,
  label,
  sublabel,
  shortcut,
  onSelect
}: CommandItemProps) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={`
        flex items-center gap-2.5 px-2 py-2 rounded-md text-sm cursor-pointer
        transition-colors outline-none
        aria-selected:bg-primary/10 aria-selected:text-foreground
        hover:bg-muted hover:text-foreground
      `}
    >
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block truncate font-medium">{label}</span>
        {sublabel && (
          <span className="block truncate text-xs text-muted-foreground">
            {sublabel}
          </span>
        )}
      </span>
      {shortcut && (
        <kbd className="shrink-0 text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  )
}
