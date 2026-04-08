// src/components/layout/right-panel.tsx
/**
 * Right panel — tabbed session context: Session, Skills, MCP, Workflow, Analytics, Artifacts.
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
import {
  differenceInWeeks,
  endOfMonth,
  isWithinInterval,
  startOfMonth
} from 'date-fns'
import { motion } from 'framer-motion'
import {
  BarChart2,
  ChevronRight,
  Cpu,
  FileCode,
  FolderTree,
  GitBranch,
  Layers,
  Play,
  Plus,
  Trash2,
  Zap
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArtifactPanel } from '@/components/artifacts/artifact-panel'
import { UnifiedSkillList } from '@/components/skills/unified-skill-list'
import { BouncingDots } from '@/components/ui/bouncing-dots'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { ModelSelectorWithIcon } from '@/components/ui/model-selector-with-icon'
import { ScrollArea } from '@/components/ui/scroll-area'
import { WorkflowEditor } from '@/components/workflow/workflow-editor'
import { WorkflowGraph } from '@/components/workflow/workflow-graph'
import { FileTreePanel } from '@/components/workspace/file-tree-panel'
import { useAnalytics } from '@/hooks/use-analytics'
import { useConversationIdFromUrl } from '@/hooks/use-conversation-id'
import { useConversations } from '@/hooks/use-conversations'
import { useProfiles } from '@/hooks/use-profiles'
import { useProviderReady } from '@/hooks/use-provider-ready'
import { useSessionStats } from '@/hooks/use-session-stats'
import {
  useDeleteWorkflowDefinition,
  useRunWorkflowDefinition,
  useWorkflowDefinitions
} from '@/hooks/use-workflow-definitions'
import { useWorkflowEvents } from '@/hooks/use-workflow-events'
import { commands } from '@/lib/bindings'
import { getProviderFromModelId } from '@/lib/model-provider'
import { cn } from '@/lib/utils'
import { useConversationStore } from '@/store/conversation'
import { type UIPersistentState, useUIPersistentStore } from '@/store/ui-state'
import { AnalyticsHeatmap } from '../analytics/analytics-heatmap'
import { ProviderIcon } from '../ui/provider-icon'
import { McpTab } from './mcp-tab'

// Feature gate selectors remain unchanged
const selectHasSkillsUnlocked = (state: UIPersistentState) =>
  state.unlockStage >= 1
const selectHasWorkflowsUnlocked = (state: UIPersistentState) =>
  state.unlockStage >= 1

type Tab =
  | 'session'
  | 'skills'
  | 'mcp'
  | 'workflow'
  | 'analytics'
  | 'artifacts'
  | 'files'

const TABS: {
  id: Tab
  label: string
  Icon: React.FC<{ className?: string }>
}[] = [
  { id: 'session', label: 'Session', Icon: Cpu },
  { id: 'skills', label: 'Skills', Icon: Layers },
  { id: 'mcp', label: 'MCP', Icon: Zap },
  { id: 'workflow', label: 'Workflow', Icon: GitBranch },
  { id: 'analytics', label: 'Analytics', Icon: BarChart2 },
  { id: 'artifacts', label: 'Artifacts', Icon: FileCode },
  { id: 'files', label: 'Files', Icon: FolderTree }
]

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('session')
  const urlConversationId = useConversationIdFromUrl()
  const conversationId = urlConversationId

  const _unlockStage = useUIPersistentStore((s) => s.unlockStage)
  const hasSkillsUnlocked = useUIPersistentStore(selectHasSkillsUnlocked)
  const hasWorkflowsUnlocked = useUIPersistentStore(selectHasWorkflowsUnlocked)

  // Filter tabs based on unlock stage
  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === 'skills') return hasSkillsUnlocked
    if (tab.id === 'workflow') return hasWorkflowsUnlocked
    // artifacts is always visible after stage 1 (skills unlocked)
    if (tab.id === 'artifacts') return hasSkillsUnlocked
    return true
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border shrink-0">
        {visibleTabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'group relative flex items-center justify-center',
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
        <div className="flex-1 min-h-0 overflow-hidden w-full min-w-0">
          <UnifiedSkillList />
        </div>
      ) : activeTab === 'artifacts' ? (
        <div className="flex-1 min-h-0 overflow-hidden w-full min-w-0">
          <ArtifactPanel />
        </div>
      ) : activeTab === 'files' ? (
        <div className="flex-1 min-h-0 overflow-hidden w-full min-w-0">
          <FileTreePanel />
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          {activeTab === 'session' && (
            <SessionTab conversationId={conversationId} />
          )}
          {activeTab === 'workflow' && <WorkflowTab />}
          {activeTab === 'analytics' && <AnalyticsTab />}
        </ScrollArea>
      )}
    </div>
  )
}

// ── Session tab (updated with provider readiness) ───────────────────────────────────────────────

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
  const { data: profiles } = useProfiles()
  const defaultProfile = profiles?.find((p) => p.is_default) ?? profiles?.[0]

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

  const { inputTokens, outputTokens } = useSessionStats(conversationId)
  const conversation = conversations?.find((c) => c.id === conversationId)
  const profile = profiles?.find((p) => p.id === conversation?.profile_id)

  const { data: readiness, isLoading: readinessLoading } = useProviderReady(
    profile?.id
  )
  const { data: models = [], isLoading: modelsLoading } = useAvailableModels(
    profile?.model_provider || ''
  )

  const [selectedModelId, setSelectedModelId] = useState(
    profile?.model_id || ''
  )

  if (!conversationId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
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

  if (!conversation) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">Conversation not found.</p>
        <Button size="xs" variant="outline" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">Profile not found.</p>
        <Button size="xs" variant="outline" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
    )
  }

  const hasKey =
    keyStatuses.find((k) => k.provider === profile.model_provider)?.has_key ??
    false
  const displayModels = models.length > 0 ? models : [profile.model_id]
  const safeSelectedModel = displayModels.includes(selectedModelId)
    ? selectedModelId
    : displayModels[0]

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
            {/* STRICTLY PROVIDER ICON */}
            <ProviderIcon
              provider={profile.model_provider}
              size={14}
              className="shrink-0"
            />
            <span className="truncate">{profile.model_provider}</span>
            {!hasKey &&
              !readinessLoading &&
              readiness?.status.status !== 'ready' && (
                <span className="text-[10px] text-amber-500 font-normal shrink-0">
                  (not configured)
                </span>
              )}
          </div>
          {!readinessLoading && readiness?.status.status === 'not_ready' && (
            <div className="mt-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
              {readiness.status.reason} {readiness.status.fix_action}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Model{' '}
            {modelsLoading && <span className="opacity-50">(loading…)</span>}
          </label>
          {/* STRICTLY MODEL ICONS INSIDE */}
          <ModelSelectorWithIcon
            value={safeSelectedModel}
            onValueChange={setSelectedModelId}
            models={displayModels}
            placeholder="Select model"
            disabled={modelsLoading}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Token Usage (Current Session)
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded border border-border p-2">
            <span className="text-muted-foreground">Input</span>
            <div className="font-mono text-base">
              {inputTokens.toLocaleString()}
            </div>
          </div>
          <div className="rounded border border-border p-2">
            <span className="text-muted-foreground">Output</span>
            <div className="font-mono text-base">
              {outputTokens.toLocaleString()}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
// ── Workflow tab (unchanged) ──────────────────────────────────────────────────────────────

function WorkflowTab() {
  const { progress } = useWorkflowEvents()
  const { data: savedWorkflows = [], isLoading } = useWorkflowDefinitions()
  const deleteWorkflow = useDeleteWorkflowDefinition()
  const runMutation = useRunWorkflowDefinition()
  const [editorOpen, setEditorOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selectedWorkflow, setSelectedWorkflow] = useState<any | null>(null)

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
                  onClick={() => {
                    setSelectedWorkflow(wf.definition)
                    setEditorOpen(true)
                  }}
                  title="Edit workflow"
                >
                  <ChevronRight className="size-3" />
                </Button>
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

      {/* Workflow graph visualization */}
      {selectedWorkflow && (
        <div className="mt-4 border-t pt-3">
          <h4 className="text-xs font-medium mb-2">Visualization</h4>
          <div className="h-64 border rounded-md bg-muted/20 p-1">
            <WorkflowGraph definition={selectedWorkflow} stepStatuses={{}} />
          </div>
        </div>
      )}

      <WorkflowEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initialDefinition={selectedWorkflow}
        onSaved={() => setSelectedWorkflow(null)}
      />
    </div>
  )
}

// ── Analytics tab ─────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const { data: analytics, isLoading, error } = useAnalytics()
  const [fullYearDialogOpen, setFullYearDialogOpen] = useState(false)

  const currentMonthStart = useMemo(() => startOfMonth(new Date()), [])
  const currentMonthEnd = useMemo(() => endOfMonth(new Date()), [])

  // Filter to current month for compact view
  const currentMonthMessages = useMemo(() => {
    if (!analytics) return []
    return analytics.messages_per_day.filter((item) => {
      const date = new Date(item.date)
      return isWithinInterval(date, {
        start: currentMonthStart,
        end: currentMonthEnd
      })
    })
  }, [analytics, currentMonthStart, currentMonthEnd])

  const currentMonthConversations = useMemo(() => {
    if (!analytics) return []
    return analytics.conversations_per_day.filter((item) => {
      const date = new Date(item.date)
      return isWithinInterval(date, {
        start: currentMonthStart,
        end: currentMonthEnd
      })
    })
  }, [analytics, currentMonthStart, currentMonthEnd])

  // Full year range: from start of the year of the earliest date to end of the year of the latest date
  const fullYearStart = useMemo(() => {
    if (!analytics) return startOfMonth(new Date())
    const allDates = [
      ...analytics.messages_per_day,
      ...analytics.conversations_per_day
    ]
      .map((d) => new Date(d.date))
      .filter((d) => !Number.isNaN(d.getTime()))
    if (allDates.length === 0) return startOfMonth(new Date())
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
    return new Date(minDate.getFullYear(), 0, 1)
  }, [analytics])

  const fullYearEnd = useMemo(() => {
    if (!analytics) return endOfMonth(new Date())
    const allDates = [
      ...analytics.messages_per_day,
      ...analytics.conversations_per_day
    ]
      .map((d) => new Date(d.date))
      .filter((d) => !Number.isNaN(d.getTime()))
    if (allDates.length === 0) return endOfMonth(new Date())
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())))
    return new Date(maxDate.getFullYear(), 11, 31)
  }, [analytics])

  // Compute the width needed for the full‑year heatmap (same as in AnalyticsHeatmap)
  const fullYearWidth = useMemo(() => {
    const weeks = Math.max(1, differenceInWeeks(fullYearEnd, fullYearStart) + 1)
    const computedWidth = (12 + 2) * weeks + 40 // rectSize=12, space=2
    return Math.min(computedWidth, 1200) // cap at 1200px
  }, [fullYearStart, fullYearEnd])

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

  return (
    <div className="p-4 space-y-5">
      {/* Overview stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3 min-w-0">
          <p className="text-xs text-muted-foreground truncate">
            Conversations
          </p>
          <p className="text-xl font-semibold truncate">
            {analytics.total_conversations}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3 min-w-0">
          <p className="text-xs text-muted-foreground truncate">Messages</p>
          <p className="text-xl font-semibold truncate">
            {analytics.total_messages}
          </p>
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

      {/* Compact month heatmap */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Activity (current month)
          </h3>
          <Dialog
            open={fullYearDialogOpen}
            onOpenChange={setFullYearDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2">
                View full year
              </Button>
            </DialogTrigger>
            <DialogContent
              className="w-auto max-w-[98vw]"
              style={{
                width: `${Math.min(fullYearWidth + 80, window.innerWidth - 40)}px`,
                maxWidth: '98vw',
                maxHeight: '90vh',
                overflowY: 'auto'
              }}
            >
              <DialogHeader>
                <DialogTitle>Activity heatmap – full year</DialogTitle>
                <DialogDescription>
                  Daily activity from the start of the year of the earliest data
                  to the end of the year of the latest data.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <AnalyticsHeatmap
                  messagesData={analytics.messages_per_day}
                  conversationsData={analytics.conversations_per_day}
                  startDate={fullYearStart}
                  endDate={fullYearEnd}
                  compact={false}
                />
              </div>
              <DialogFooter>
                <Button onClick={() => setFullYearDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div>
          <AnalyticsHeatmap
            messagesData={currentMonthMessages}
            conversationsData={currentMonthConversations}
            startDate={currentMonthStart}
            endDate={currentMonthEnd}
            compact={true}
          />
        </div>
      </div>

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
    </div>
  )
}
