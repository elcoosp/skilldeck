// src/components/layout/right-panel.tsx
/**
 * Right panel — tabbed session context: Session, Skills, MCP, Workflow, Analytics.
 *
 * Tab bar shows icons only. On hover the label fades in and smoothly pushes
 * sibling icons apart via a max-width transition (no layout jumps).
 *
 * Each tab uses flex-1 so all five tabs share the bar width equally and never
 * shift position when a label slides in — the icon stays centred in its
 * reserved slot at all times.
 *
 * Skills tab now renders the UnifiedSkillList — a virtualized marketplace that
 * merges local and registry skills into a single high-performance grid.
 */

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BarChart2,
  ChevronRight,
  Cpu,
  GitBranch,
  Layers,
  Plus,
  Trash2,
  Zap,
  Play
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { openUrl } from '@tauri-apps/plugin-opener'  // <-- added
import { UnifiedSkillList } from '@/components/skills/unified-skill-list'
import { BouncingDots } from '@/components/ui/bouncing-dots'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { WorkflowEditor } from '@/components/workflow/workflow-editor'
import { useAnalytics } from '@/hooks/use-analytics'
import { useConversations } from '@/hooks/use-conversations'
import { useProfiles } from '@/hooks/use-profiles'
import {
  useDeleteWorkflowDefinition,
  useWorkflowDefinitions,
  useRunWorkflowDefinition
} from '@/hooks/use-workflow-definitions'
import { useWorkflowEvents } from '@/hooks/use-workflow-events'
import { commands } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'
import { McpTab } from './mcp-tab'

type Tab = 'session' | 'skills' | 'mcp' | 'workflow' | 'analytics'

const TABS: {
  id: Tab
  label: string
  Icon: React.FC<{ className?: string }>
}[] = [
    { id: 'session', label: 'Session', Icon: Cpu },
    { id: 'skills', label: 'Skills', Icon: Layers },
    { id: 'mcp', label: 'MCP', Icon: Zap },
    { id: 'workflow', label: 'Workflow', Icon: GitBranch },
    { id: 'analytics', label: 'Analytics', Icon: BarChart2 }
  ]

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('session')
  const activeConversationId = useUIStore((s) => s.activeConversationId)

  return (
    <div className="flex flex-col h-full">
      {/*
        Tab bar — each tab takes an equal share of the full bar width (flex-1).
        The icon is always centred inside that reserved slot. The label fades
        in on hover WITHOUT displacing the icon or shifting neighbouring tabs,
        because the tab's width never changes.
      */}
      <div className="flex border-b border-border shrink-0">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'group relative flex items-center justify-center',
              // min-w holds space for the icon; width grows smoothly to fit label
              'min-w-[2.25rem] px-2 py-2.5 text-xs font-medium',
              'transition-[color,width] duration-200 ease-in-out',
              activeTab === id
                ? 'text-foreground border-b-2 border-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            <span
              className={cn(
                'whitespace-nowrap overflow-hidden pointer-events-none',
                // width:0 → auto via max-width; smooth, no jump
                'max-w-0 group-hover:max-w-[6rem]',
                'ml-0 group-hover:ml-1.5',
                'opacity-0 group-hover:opacity-100',
                'transition-[max-width,margin-left,opacity] duration-200 ease-in-out'
              )}
            >
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'mcp' ? (
        <div className="flex-1 min-h-0 overflow-hidden w-full min-w-0">
          <McpTab />
        </div>
      ) : activeTab === 'skills' ? (
        // Skills tab owns its own scroll and layout (virtualized marketplace)
        <div className="flex-1 min-h-0 overflow-hidden w-full min-w-0">
          <UnifiedSkillList />
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          {activeTab === 'session' && (
            <SessionTab conversationId={activeConversationId} />
          )}
          {activeTab === 'workflow' && <WorkflowTab />}
          {activeTab === 'analytics' && <AnalyticsTab />}
        </ScrollArea>
      )}
    </div>
  )
}

// ── Session tab ───────────────────────────────────────────────────────────────

function useAvailableModels(provider: string) {
  return useQuery({
    queryKey: ['available-models', provider],
    queryFn: async (): Promise<string[]> => {
      if (provider === 'ollama') {
        const res = await commands.listOllamaModels()
        if (res.status === 'ok') return res.data.map((m) => m.id)
        throw new Error(res.error)
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
  // Get profiles and default profile to pass to conversations query
  const { data: profiles } = useProfiles()
  const defaultProfile = profiles?.find((p) => p.is_default) ?? profiles?.[0]

  // Pass profileId to useConversations() so it uses the SAME query key as left-panel
  const {
    data: conversations,
    isLoading: conversationsLoading,
    refetch
  } = useConversations(defaultProfile?.id)

  const { data: keyStatuses = [] } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const res = await commands.listApiKeys()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 30_000
  })

  if (!conversationId) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        No active conversation.
      </div>
    )
  }

  if (conversationsLoading) {
    return (
      <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
        <div className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading conversations...
      </div>
    )
  }

  const conversation = conversations?.find((c) => c.id === conversationId)

  if (!conversation) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Conversation not found. It may still be loading or may have been
          deleted.
        </p>
        <div className="flex gap-2">
          <Button size="xs" variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>
    )
  }

  const profile = profiles?.find((p) => p.id === conversation.profile_id)
  if (!profile) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Profile for this conversation not found.
        </p>
        <Button size="xs" variant="outline" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
    )
  }

  const hasKeyForProvider = (p: string) =>
    keyStatuses.find((k) => k.provider === p)?.has_key ?? false
  const effectiveProvider = hasKeyForProvider(profile.model_provider)
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

        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Provider</span>
          <div className="text-xs font-medium px-2 py-1 rounded bg-muted/50 flex items-center gap-1.5">
            {effectiveProvider}
            {isUsingFallback && (
              <span
                className="text-[10px] text-amber-500 font-normal"
                title={`No API key found for ${profile.model_provider}. Using local Ollama instead.`}
              >
                (fallback)
              </span>
            )}
          </div>
        </div>

        <ModelSelector
          provider={effectiveProvider}
          currentModelId={profile.model_id}
        />
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
  const [selected, setSelected] = useState(currentModelId)
  const displayModels = models.length > 0 ? models : [currentModelId]
  const safeSelected = displayModels.includes(selected)
    ? selected
    : displayModels[0]

  return (
    <div className="space-y-1">
      <label htmlFor="model-select" className="text-xs text-muted-foreground">
        Model {isLoading && <span className="opacity-50">(loading…)</span>}
      </label>
      <Select value={safeSelected} onValueChange={setSelected}>
        <SelectTrigger id="model-select" className="h-7 text-xs">
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

// ── Workflow tab ──────────────────────────────────────────────────────────────

function WorkflowTab() {
  const { progress } = useWorkflowEvents()
  const { data: savedWorkflows = [], isLoading } = useWorkflowDefinitions()
  const deleteWorkflow = useDeleteWorkflowDefinition()
  const runMutation = useRunWorkflowDefinition()
  const [editorOpen, setEditorOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete workflow "${name}"?`)) {
      deleteWorkflow.mutate(id, {
        onSuccess: () => toast.success('Workflow deleted'),
        onError: (err) => toast.error(`Failed to delete: ${err}`)
      })
    }
  }

  return (
    <div className="p-3 space-y-4">
      {/* Active workflow (running) */}
      {progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Workflow
            </h3>
            <span
              className={cn(
                'text-xs font-medium',
                progress.status === 'running'
                  ? 'text-blue-500'
                  : progress.status === 'completed'
                    ? 'text-green-500'
                    : 'text-red-500'
              )}
            >
              {progress.status}
            </span>
          </div>

          <p className="text-xs font-mono text-muted-foreground break-all">
            {progress.workflowId}
          </p>

          {progress.error && (
            <div className="p-2 rounded-md bg-red-500/10 text-xs text-red-500">
              {progress.error}
            </div>
          )}

          <div className="space-y-1">
            {Object.values(progress.steps).map((step) => {
              const isOpen = expanded[step.stepId]
              const stepColor = {
                pending: 'bg-muted-foreground/30',
                running: 'bg-blue-500 animate-pulse',
                completed: 'bg-green-500',
                failed: 'bg-red-500'
              }[step.status]

              return (
                <div
                  key={step.stepId}
                  className="rounded-md border border-border overflow-hidden"
                >
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full p-2 text-left hover:bg-muted/50 transition-colors"
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [step.stepId]: !isOpen
                      }))
                    }
                  >
                    <div
                      className={cn('size-2 rounded-full shrink-0', stepColor)}
                    />
                    <span className="text-xs font-medium flex-1 truncate">
                      {step.stepId}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {step.status}
                    </span>
                    <ChevronRight
                      className={cn(
                        'size-3 text-muted-foreground transition-transform',
                        isOpen && 'rotate-90'
                      )}
                    />
                  </button>
                  {isOpen && step.result && (
                    <div className="px-3 pb-2 pt-0">
                      <p className="text-xs text-muted-foreground font-mono break-words whitespace-pre-wrap line-clamp-6">
                        {step.result}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Saved workflows */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Saved Workflows
          </h3>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setEditorOpen(true)}
          >
            <Plus className="size-3 mr-1" />
            New
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <BouncingDots />
          </div>
        ) : savedWorkflows.length === 0 ? (
          // ✨ Whimsical empty state with fade+scale animation
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex flex-col items-center justify-center py-8 px-4 text-center"
          >
            <div className="w-40 h-40 mb-4 overflow-hidden rounded-3xl">
              <img
                src="/illustrations/empty-workflows.jpeg"
                alt="No workflows"
                className="w-full h-full object-cover opacity-90"
              />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              Ready to orchestrate something brilliant?
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Design a workflow that turns complex tasks into elegant
              automation.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-1">
            {savedWorkflows.map((wf) => (
              <div
                key={wf.id}
                className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{wf.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Updated {new Date(wf.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => runMutation.mutate(wf.id)}
                  disabled={runMutation.isPending}
                  title="Run workflow"
                >
                  <Play className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleDelete(wf.id, wf.name)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <WorkflowEditor open={editorOpen} onOpenChange={setEditorOpen} />
    </div>
  )
}

// ── Analytics tab ─────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const { data: analytics, isLoading, error } = useAnalytics()

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <BouncingDots />
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className="p-4 text-sm text-destructive">
        Failed to load analytics: {String(error)}
      </div>
    )
  }

  const maxTokens =
    analytics.messages_per_day.length > 0
      ? Math.max(...analytics.messages_per_day.map((d) => d.count))
      : 1

  return (
    <div className="p-4 space-y-5">
      {/* Overview stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Conversations</p>
          <p className="text-xl font-semibold">
            {analytics.total_conversations}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Messages</p>
          <p className="text-xl font-semibold">{analytics.total_messages}</p>
        </div>
      </div>

      {/* Token usage */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Token Usage
        </p>
        <div className="flex justify-between text-sm">
          <span>Input</span>
          <span className="font-mono">
            {analytics.token_usage.input_tokens.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Output</span>
          <span className="font-mono">
            {analytics.token_usage.output_tokens.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm font-medium pt-1 border-t">
          <span>Total</span>
          <span className="font-mono">
            {analytics.token_usage.total_tokens.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Messages per day */}
      {analytics.messages_per_day.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Messages — Last 30 Days
          </h3>
          <div className="flex items-end gap-1 h-20">
            {analytics.messages_per_day.map(({ date, count }) => (
              <div
                key={date}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div
                  className="w-full rounded-t bg-primary/60 transition-all"
                  style={{ height: `${(count / maxTokens) * 100}%` }}
                />
                <span className="text-[9px] text-muted-foreground">
                  {new Date(date).getDate()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills used */}
      {analytics.skills_used.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Most Used Skills
          </h3>
          {analytics.skills_used.slice(0, 5).map(({ name, count }) => (
            <div key={name} className="flex justify-between text-sm">
              <span className="truncate">{name}</span>
              <span className="font-mono">{count}</span>
            </div>
          ))}
        </div>
      )}

      {analytics.messages_per_day.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No activity yet. Start a conversation to see analytics.
        </p>
      )}
    </div>
  )
}
