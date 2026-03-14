/**
 * Right panel — tabbed session context: Skills active, MCP servers, session info.
 */

import { useState } from 'react'
import { Cpu, Layers, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useSkills } from '@/hooks/use-skills'
import { useMcpServers } from '@/hooks/use-mcp'
import { useConversations } from '@/hooks/use-conversations'
import { useProfiles } from '@/hooks/use-profiles'
import { useUIStore } from '@/store/ui'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { listApiKeys, listOllamaModels } from '@/lib/invoke'

type Tab = 'session' | 'skills' | 'mcp'

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('session')
  const activeConversationId = useUIStore((s) => s.activeConversationId)

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        {(
          [
            { id: 'session', label: 'Session', Icon: Cpu },
            { id: 'skills', label: 'Skills', Icon: Layers },
            { id: 'mcp', label: 'MCP', Icon: Zap }
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
              activeTab === id
                ? 'text-foreground border-b-2 border-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <ScrollArea className="flex-1 min-h-0">
        {activeTab === 'session' && (
          <SessionTab conversationId={activeConversationId} />
        )}
        {activeTab === 'skills' && <SkillsTab />}
        {activeTab === 'mcp' && <McpTab />}
      </ScrollArea>
    </div>
  )
}

// ── Session tab ───────────────────────────────────────────────────────────────

/** Fetch available models for a provider.
 *
 * For Ollama, calls the `list_ollama_models` Tauri command (which runs
 * `ollama list` on the Rust side) so the dropdown reflects what is actually
 * installed locally.  For other providers the list is static for now.
 */
function useAvailableModels(provider: string) {
  return useQuery({
    queryKey: ['available-models', provider],
    queryFn: async (): Promise<string[]> => {
      if (provider === 'ollama') {
        const models = await listOllamaModels()
        return models.map((m) => m.id)
      }
      if (provider === 'claude') {
        return ['claude-sonnet-4-5', 'claude-opus-4', 'claude-3-5-sonnet']
      }
      if (provider === 'openai') {
        return ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo']
      }
      return []
    },
    staleTime: 60_000
  })
}

function SessionTab({ conversationId }: { conversationId: string | null }) {
  const { data: conversations } = useConversations()
  const { data: profiles } = useProfiles()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

  // Check which providers have API keys registered
  const { data: keyStatuses = [] } = useQuery({
    queryKey: ['api-keys'],
    queryFn: listApiKeys,
    staleTime: 30_000
  })

  if (!conversationId) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        No active conversation.
      </div>
    )
  }

  const conversation = conversations?.find((c) => c.id === conversationId)
  if (!conversation) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Loading conversation...
      </div>
    )
  }

  const profile = profiles?.find((p) => p.id === conversation.profile_id)
  if (!profile) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Profile not found.
      </div>
    )
  }

  // Determine the effective provider: if the profile's provider has no key,
  // fall back to ollama (which is keyless by default).
  const hasKeyForProvider = (provider: string) =>
    keyStatuses.find((k) => k.provider === provider)?.has_key ?? false

  const effectiveProvider =
    hasKeyForProvider(profile.model_provider)
      ? profile.model_provider
      : 'ollama'

  const isUsingFallback = effectiveProvider !== profile.model_provider

  return (
    <div className="p-4 space-y-4">
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Active Conversation
        </h3>
        <p className="text-xs font-mono text-muted-foreground break-all">
          {conversationId}
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Profile & Model
        </h3>

        {/* Profile switcher */}
        {profiles && profiles.length > 1 && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Profile</label>
            <Select
              value={profile.id}
              onValueChange={(v) => setSelectedProfileId(v)}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Select profile" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name} {p.is_default ? '(default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Model provider */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Provider</label>
          <div className="text-xs font-medium px-2 py-1 rounded bg-muted/50 flex items-center gap-1.5">
            {effectiveProvider}
            {isUsingFallback && (
              <span className="text-[10px] text-amber-500 font-normal">
                (no API key — using Ollama)
              </span>
            )}
          </div>
        </div>

        {/* Model selector — populated dynamically */}
        <ModelSelector provider={effectiveProvider} currentModelId={profile.model_id} />
      </section>
    </div>
  )
}

function ModelSelector({
  provider,
  currentModelId
}: {
  provider: string
  currentModelId: string
}) {
  const { data: models = [], isLoading } = useAvailableModels(provider)

  // Track the user's in-session selection separately from the profile value.
  // Initialise to currentModelId; once models load we correct it if the
  // profile's model isn't in the fetched list (e.g. ollama fallback).
  const [selected, setSelected] = useState(currentModelId)

  const displayModels = models.length > 0 ? models : [currentModelId]
  const safeSelected = displayModels.includes(selected)
    ? selected
    : displayModels[0]

  const handleModelChange = (newModel: string) => {
    setSelected(newModel)
    // TODO: persist via profile update mutation
    console.log('Model changed to', newModel)
  }

  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">
        Model {isLoading && <span className="opacity-50">(loading…)</span>}
      </label>
      <Select value={safeSelected} onValueChange={handleModelChange}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          {displayModels.map((m) => (
            <SelectItem key={m} value={m} className="text-xs">
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ── Skills tab ────────────────────────────────────────────────────────────────

function SkillItem({ skill, isActive }: { skill: any; isActive: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const hasDescription = !!skill.description

  return (
    // overflow-hidden clips any child that tries to escape horizontally.
    // w-full ensures it fills the parent column, not its content width.
    <div
      className={cn(
        "flex items-start gap-2 p-2 rounded-md w-full overflow-hidden",
        isActive ? "bg-muted/50" : "opacity-50"
      )}
    >
      <div
        className={cn(
          "size-1.5 rounded-full mt-1.5 shrink-0",
          isActive ? "bg-green-500" : "bg-muted-foreground"
        )}
      />
      {/* w-0 + min-w-0 + flex-1: forces the flex child to shrink below its
          text content width. Without w-0 the flex algorithm uses max-content
          as the floor, so truncate never triggers. */}
      <div className="flex-1 min-w-0 w-0">
        <p className="text-xs font-medium truncate">{skill.name}</p>
        {hasDescription && (
          <div className="flex items-start gap-1 mt-0.5 w-full">
            <p
              className={cn(
                "text-xs text-muted-foreground flex-1 min-w-0 w-0",
                expanded ? "break-words whitespace-normal" : "truncate"
              )}
            >
              {skill.description}
            </p>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
function SkillsTab() {
  const { data: skills = [], isLoading } = useSkills()

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const active = skills.filter((s) => s.is_active)
  const inactive = skills.filter((s) => !s.is_active)

  return (
    <div className="p-3 space-y-3">
      {active.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Active ({active.length})
          </h3>
          <div className="space-y-1">
            {active.map((s) => (
              <SkillItem key={s.name} skill={s} isActive={true} />
            ))}
          </div>
        </section>
      )}

      {inactive.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Available ({inactive.length})
          </h3>
          <div className="space-y-1">
            {inactive.map((s) => (
              <SkillItem key={s.name} skill={s} isActive={false} />
            ))}
          </div>
        </section>
      )}

      {skills.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No skills loaded. Add skills to{' '}
          <code className="text-xs">.skilldeck/skills/</code> in your workspace
          or to <code className="text-xs">~/.agents/skills/</code> globally.
        </p>
      )}
    </div>
  )
}

// ── MCP tab ───────────────────────────────────────────────────────────────────

function McpTab() {
  const { data: servers = [], isLoading } = useMcpServers()

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
      {servers.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No MCP servers configured.
        </p>
      ) : (
        servers.map((server) => (
          <div key={server.id} className="p-2 rounded-md border border-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">{server.name}</span>
              <Badge
                variant={
                  server.status === 'connected' ? 'default' : 'secondary'
                }
                className="text-xs"
              >
                {server.status}
              </Badge>
            </div>
            {server.tools.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {server.tools.length} tool{server.tools.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  )
}
