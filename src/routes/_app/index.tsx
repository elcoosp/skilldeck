// src/routes/_app/index.tsx
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  GitBranch,
  KeyRound,
  Layers,
  MessageSquarePlus,
  ShieldCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { toast } from '@/components/ui/toast'
import { useCreateConversation } from '@/hooks/use-conversations'
import { useProfiles } from '@/hooks/use-profiles'
import { suggestedPrompts } from '@/lib/suggested-prompts'
import { cn } from '@/lib/utils'
import { useConversationStore } from '@/store/conversation'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'
import { useUILayoutStore } from '@/store/ui-layout'
import { useWorkspaceStore } from '@/store/workspace'

export const Route = createFileRoute('/_app/')({
  component: HomeBriefing
})

function HomeBriefing() {
  const router = useRouter()
  const setActiveConversation = useConversationStore(
    (s) => s.setActiveConversation
  )
  const setRightTab = useUILayoutStore((s) => s.setRightTab)
  const setDraft = useUIEphemeralStore((s) => s.setDraft)

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const { data: allProfiles } = useProfiles(true)
  const defaultProfile =
    allProfiles?.find((p) => p.is_default) ?? allProfiles?.[0]
  const createConversation = useCreateConversation(defaultProfile?.id)

  const ready = Boolean(defaultProfile && activeWorkspaceId)

  const startConversation = async (prompt?: string) => {
    if (!defaultProfile) {
      toast.error('No profile found. Add one in Settings.')
      return
    }
    if (!activeWorkspaceId) {
      toast.error('No workspace selected. Open or create a workspace first.')
      return
    }
    try {
      const id = await createConversation.mutateAsync({})
      if (prompt) setDraft(id, prompt)
      setActiveConversation(id)
      router.navigate({
        to: '/conversations/$conversationId',
        params: { conversationId: id }
      })
    } catch {
      toast.error('Failed to create conversation')
    }
  }

  const chips = suggestedPrompts.slice(0, 6)

  return (
    <div className="h-full overflow-y-auto thin-scrollbar flex items-center justify-center px-6">
      <div className="w-full max-w-lg py-10">
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-foreground">
          Start a conversation
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your code, keys, and prompts stay on this machine. Agents run locally,
          and every tool call waits for your approval.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button onClick={() => startConversation()} disabled={!ready}>
            <MessageSquarePlus className="size-4" />
            New conversation
          </Button>
          <Button variant="outline" onClick={() => setRightTab('skills')}>
            <Layers className="size-4" />
            Browse skills
          </Button>
        </div>

        <div className="mt-8">
          <div className="flex flex-wrap gap-1.5">
            {chips.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => startConversation(p.prompt)}
                className={cn(
                  'rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground',
                  'transition-colors hover:border-primary/40 hover:bg-primary/5',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-8 border-t border-border">
          {[
            {
              icon: (
                <ShieldCheck className="size-4 text-[var(--tone-success)]" />
              ),
              title: 'Approval-gated tools',
              desc: 'Reads, writes, and shell calls pause for your sign-off.'
            },
            {
              icon: <Layers className="size-4 text-[var(--tone-info)]" />,
              title: 'Skills are files',
              desc: 'Version-controlled Markdown, resolved from your workspace first.'
            },
            {
              icon: <GitBranch className="size-4 text-primary" />,
              title: 'Branch any message',
              desc: 'Explore alternatives without losing the thread.'
            }
          ].map((row) => (
            <li
              key={row.title}
              className="flex items-start gap-3 border-b border-border py-3"
            >
              <span className="mt-0.5 shrink-0">{row.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">
                  {row.title}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {row.desc}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <KeyRound className="size-3.5" />
          Press
          <Kbd>⌘K</Kbd>
          for the command palette
        </p>
      </div>
    </div>
  )
}
