/**
 * Right panel — tabbed session context: Skills active, MCP servers, session info.
 */

import { useState } from 'react'
import { Cpu, Layers, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSkills } from '@/hooks/use-skills'
import { useMcpServers } from '@/hooks/use-mcp'
import { useUIStore } from '@/store/ui'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

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
      <ScrollArea className="flex-1">
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

function SessionTab({ conversationId }: { conversationId: string | null }) {
  if (!conversationId) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        No active conversation.
      </div>
    )
  }

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
    </div>
  )
}

// ── Skills tab ────────────────────────────────────────────────────────────────

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
              <div
                key={s.name}
                className="flex items-start gap-2 p-2 rounded-md bg-muted/50"
              >
                <div className="size-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.description}
                  </p>
                </div>
              </div>
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
              <div
                key={s.name}
                className="flex items-start gap-2 p-2 rounded-md opacity-50"
              >
                <div className="size-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{s.name}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {skills.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No skills loaded. Add skills to{' '}
          <code className="text-xs">.skilldeck/skills/</code> in your workspace.
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
