/**
 * CommandPalette — global ⌘K overlay powered by cmdk.
 *
 * Groups:
 *   • Conversations — fuzzy-search recent conversations
 *   • Skills        — toggle or inspect loaded skills
 *   • Actions       — new chat, open workspace, settings
 */

import { useEffect } from 'react'
import { Command } from 'cmdk'
import { MessageSquare, Plus, Layers, Settings, FolderOpen } from 'lucide-react'
import { useUIStore } from '@/store/ui'
import {
  useConversations,
  useCreateConversation
} from '@/hooks/use-conversations'
import { useSkills } from '@/hooks/use-skills'
import { useProfiles } from '@/hooks/use-profiles'

export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen)
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const setActiveConversation = useUIStore((s) => s.setActiveConversation)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)

  const { data: conversations = [] } = useConversations()
  const { data: skills = [] } = useSkills()
  const { data: profiles = [] } = useProfiles()
  const createConversation = useCreateConversation()

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, setOpen])

  if (!open) return null

  const defaultProfile = profiles.find((p) => p.is_default) ?? profiles[0]

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      {/* Panel — stop propagation so clicks inside don't close */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl mx-4 rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
      >
        <Command className="[&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-border">
          <Command.Input
            autoFocus
            placeholder="Search conversations, skills, actions…"
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
                    createConversation.mutate({ profileId: defaultProfile.id })
                  }
                  setOpen(false)
                }}
              />
              <CommandItem
                icon={<Settings className="size-4" />}
                label="Settings"
                shortcut="⌘,"
                onSelect={() => {
                  setSettingsOpen(true)
                  setOpen(false)
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
            {skills.length > 0 && (
              <Command.Group
                heading="Skills"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {skills.slice(0, 6).map((s) => (
                  <CommandItem
                    key={s.name}
                    icon={<Layers className="size-4" />}
                    label={s.name}
                    sublabel={s.description}
                    onSelect={() => setOpen(false)}
                  />
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}

// ── Internal helper ───────────────────────────────────────────────────────────

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
      className="flex items-center gap-2.5 px-2 py-2 rounded-md text-sm cursor-pointer
        aria-selected:bg-accent aria-selected:text-accent-foreground
        hover:bg-accent hover:text-accent-foreground transition-colors outline-none"
    >
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block truncate">{label}</span>
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
