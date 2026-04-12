// src/components/layout/right-panel.tsx
/**
 * Right panel — tabbed session context: Session, Skills, MCP, Workflow, Analytics, Artifacts.
 *
 * Vertical icon rail on the right edge, always visible. Icons are grouped with a separator.
 * Active tab shows a subtle background highlight. Content area fills the remaining space.
 */

import { useQuery } from '@tanstack/react-query'
import {
  differenceInWeeks,
  endOfMonth,
  isWithinInterval,
  startOfMonth
} from 'date-fns'
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
  Search,
  Trash2,
  Workflow,
  X,
  Zap
} from 'lucide-react'
import { useMemo, useState, useCallback, useRef } from 'react'
import { toast } from '@/components/ui/toast'
import { ArtifactPanel } from '@/components/artifacts/artifact-panel'
import { UnifiedSkillList } from '@/components/skills/unified-skill-list'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
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
import { RightPanelHeader } from './right-panel-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'
import { AnimatedSuccessIcon } from '../ui/animated-success-icon'

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

// Group definitions for visual separation
const PRIMARY_TAB_IDS: Tab[] = ['session', 'skills', 'mcp', 'artifacts', 'files']
const SECONDARY_TAB_IDS: Tab[] = ['workflow', 'analytics']

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

  // Split visible tabs into primary and secondary groups while preserving order
  const primaryTabs = visibleTabs.filter((tab) =>
    PRIMARY_TAB_IDS.includes(tab.id)
  )
  const secondaryTabs = visibleTabs.filter((tab) =>
    SECONDARY_TAB_IDS.includes(tab.id)
  )

  return (
    <TooltipProvider delayDuration={300}>
      {/*
        CRITICAL: basis-0 forces flex items to size from available space,
        not content. min-w-0 allows shrinking below content size.
        overflow-hidden clips any overflow.
      */}
      <div className="flex flex-row h-full w-full overflow-hidden">
        {/* Content area (left) - basis-0 is the key fix */}
        <div className="flex-1 basis-0 min-w-0 overflow-hidden flex flex-col">
          {activeTab === 'mcp' ? (
            <McpTab />
          ) : activeTab === 'skills' ? (
            <UnifiedSkillList />
          ) : activeTab === 'artifacts' ? (
            <ArtifactPanel />
          ) : activeTab === 'files' ? (
            <FileTreePanel />
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

        {/* Vertical icon rail (right side) – fixed width, never shrinks */}
        <div className="w-10 shrink-0 border-l border-border bg-background flex flex-col items-center py-2">
          {/* Primary group */}
          <div className="flex flex-col items-center gap-1 w-full">
            {primaryTabs.map(({ id, label, Icon }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      'relative flex items-center justify-center w-8 h-8 rounded-full',
                      'transition-colors duration-150',
                      'hover:bg-muted/60',
                      activeTab === id
                        ? 'text-primary bg-muted'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    aria-label={label}
                  >
                    <Icon className="size-4 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" align="center">
                  {label}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Separator between groups */}
          {secondaryTabs.length > 0 && (
            <div className="w-6 h-px bg-border my-2 shrink-0" />
          )}

          {/* Secondary group (pushed to bottom with mt-auto) */}
          <div className="flex flex-col items-center gap-1 w-full mt-auto">
            {secondaryTabs.map(({ id, label, Icon }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      'relative flex items-center justify-center w-8 h-8 rounded-full',
                      'transition-colors duration-150',
                      'hover:bg-muted/60',
                      activeTab === id
                        ? 'text-primary bg-muted'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    aria-label={label}
                  >
                    <Icon className="size-4 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" align="center">
                  {label}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
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

  // Determine if an API key exists for the current provider
  const hasKey = useMemo(() => {
    if (!profile) return false
    const provider = profile.model_provider
    return keyStatuses.some((k) => k.provider === provider)
  }, [keyStatuses, profile])

  // Fallback model display values
  const safeSelectedModel = selectedModelId || profile?.model_id || ''
  const displayModels = useMemo(() => {
    if (models.length > 0) return models
    return profile?.model_id ? [profile.model_id] : []
  }, [models, profile])

  // Always render header, content varies based on state
  return (
    <div className="flex flex-col h-full">
      <RightPanelHeader title="Session" />
      <div className="flex-1 min-h-0">
        {!conversationId ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={Cpu}
              title="No active conversation"
              description="Select or start a conversation to see session details."
            />
          </div>
        ) : conversationsLoading ? (
          <LoadingState message="Loading conversation…" />
        ) : !conversation ? (
          <div className="p-3 space-y-3">
            <p className="text-xs text-muted-foreground">Conversation not found.</p>
            <Button size="xs" variant="outline" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        ) : !profile ? (
          <div className="p-3 space-y-3">
            <p className="text-xs text-muted-foreground">Profile not found.</p>
            <Button size="xs" variant="outline" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-3 space-y-4">
              <section>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Active Conversation
                </h3>
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {conversationId}
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Profile & Model
                </h3>

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Provider</span>
                  <div className="text-xs font-medium px-2 py-1 rounded bg-muted/50 flex items-center gap-1.5 min-w-0">
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
                      Can't connect to provider – {readiness.status.reason.toLowerCase()}. {readiness.status.fix_action}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Model{' '}
                    {modelsLoading && <span className="opacity-50">(loading…)</span>}
                  </label>
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
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Token Usage
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded border border-border p-2 min-w-0">
                    <span className="text-muted-foreground text-xs">Input</span>
                    <div className="font-mono text-sm truncate">
                      {inputTokens.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded border border-border p-2 min-w-0">
                    <span className="text-muted-foreground text-xs">Output</span>
                    <div className="font-mono text-sm truncate">
                      {outputTokens.toLocaleString()}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </ScrollArea>
        )}
      </div>
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
  const [selectedWorkflow, setSelectedWorkflow] = useState<any | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [showRunSuccess, setShowRunSuccess] = useState(false)

  const filteredWorkflows = useMemo(() => {
    if (!searchQuery.trim()) return savedWorkflows
    return savedWorkflows.filter((wf) =>
      wf.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [savedWorkflows, searchQuery])

  const toggleSearch = useCallback(() => {
    setShowSearch((prev) => !prev)
    if (!showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [showSearch])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    searchInputRef.current?.focus()
  }, [])

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete workflow "${name}"?`)) {
      deleteWorkflow.mutate(id, {
        onSuccess: () => toast.success('Workflow deleted'),
        onError: (err) => toast.error(`Failed to delete: ${err}`)
      })
    }
  }

  const handleRun = (id: string) => {
    runMutation.mutate(id, {
      onSuccess: () => setShowRunSuccess(true)
    })
  }

  return (
    <div className="flex flex-col h-full">
      <RightPanelHeader
        title="Workflow"
        actions={
          <div className="flex items-center gap-1">
            {showSaveSuccess && (
              <AnimatedSuccessIcon onComplete={() => setShowSaveSuccess(false)} />
            )}
            {showRunSuccess && (
              <AnimatedSuccessIcon onComplete={() => setShowRunSuccess(false)} />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={toggleSearch}
              title="Search workflows"
            >
              <Search className="size-4" />
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setEditorOpen(true)}
            >
              <Plus className="size-3 mr-1" />
              New
            </Button>
          </div>
        }
      />

      {/* Expandable search bar */}
      {showSearch && (
        <div className="px-3 py-2 border-b border-border/50 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Filter workflows…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-8 h-8 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 p-3 space-y-4">
        {/* ... progress section unchanged ... */}

        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Saved Workflows
          </h3>

          {isLoading ? (
            <LoadingState message="Loading saved workflows…" />
          ) : filteredWorkflows.length === 0 ? (
            <EmptyState
              icon={Workflow}
              title={searchQuery ? 'No matching workflows' : 'No workflows'}
              description={
                searchQuery
                  ? 'Try a different search term'
                  : "You haven't created any workflows yet. Build one to automate tasks."
              }
              action={
                !searchQuery
                  ? {
                    label: 'New Workflow',
                    onClick: () => setEditorOpen(true)
                  }
                  : undefined
              }
            />
          ) : (
            <div className="space-y-1">
              {filteredWorkflows.map((wf) => (
                <div
                  key={wf.id}
                  className="flex items-center gap-1 p-2 rounded-md border border-border hover:bg-muted/30 transition-colors min-w-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{wf.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {new Date(wf.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button size="icon-xs" variant="ghost" onClick={() => { setSelectedWorkflow(wf.definition); setEditorOpen(true) }} title="Edit" className="shrink-0">
                    <ChevronRight className="size-3" />
                  </Button>
                  <Button size="icon-xs" variant="ghost" onClick={() => handleRun(wf.id)} disabled={runMutation.isPending} title="Run" className="shrink-0">
                    <Play className="size-3" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(wf.id, wf.name)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedWorkflow && (
          <div className="mt-4 border-t pt-3">
            <h4 className="text-xs font-medium mb-2">Visualization</h4>
            <div className="h-64 border rounded-md bg-muted/20 p-1 overflow-hidden">
              <WorkflowGraph definition={selectedWorkflow} stepStatuses={{}} />
            </div>
          </div>
        )}

        <WorkflowEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          initialDefinition={selectedWorkflow}
          onSaved={() => {
            setSelectedWorkflow(null)
            setShowSaveSuccess(true)
          }}
        />
      </div>
    </div>
  )
}

// ── Analytics tab ─────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const { data: analytics, isLoading, error } = useAnalytics()
  const [fullYearDialogOpen, setFullYearDialogOpen] = useState(false)

  const currentMonthStart = useMemo(() => startOfMonth(new Date()), [])
  const currentMonthEnd = useMemo(() => endOfMonth(new Date()), [])

  const currentMonthMessages = useMemo(() => {
    if (!analytics) return []
    return analytics.messages_per_day.filter((item) => {
      const date = new Date(item.date)
      return isWithinInterval(date, { start: currentMonthStart, end: currentMonthEnd })
    })
  }, [analytics, currentMonthStart, currentMonthEnd])

  const currentMonthConversations = useMemo(() => {
    if (!analytics) return []
    return analytics.conversations_per_day.filter((item) => {
      const date = new Date(item.date)
      return isWithinInterval(date, { start: currentMonthStart, end: currentMonthEnd })
    })
  }, [analytics, currentMonthStart, currentMonthEnd])

  const fullYearStart = useMemo(() => {
    if (!analytics) return startOfMonth(new Date())
    const allDates = [...analytics.messages_per_day, ...analytics.conversations_per_day]
      .map((d) => new Date(d.date))
      .filter((d) => !Number.isNaN(d.getTime()))
    if (allDates.length === 0) return startOfMonth(new Date())
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
    return new Date(minDate.getFullYear(), 0, 1)
  }, [analytics])

  const fullYearEnd = useMemo(() => {
    if (!analytics) return endOfMonth(new Date())
    const allDates = [...analytics.messages_per_day, ...analytics.conversations_per_day]
      .map((d) => new Date(d.date))
      .filter((d) => !Number.isNaN(d.getTime()))
    if (allDates.length === 0) return endOfMonth(new Date())
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())))
    return new Date(maxDate.getFullYear(), 11, 31)
  }, [analytics])

  const fullYearWidth = useMemo(() => {
    const weeks = Math.max(1, differenceInWeeks(fullYearEnd, fullYearStart) + 1)
    const computedWidth = (12 + 2) * weeks + 40
    return Math.min(computedWidth, 1200)
  }, [fullYearStart, fullYearEnd])

  if (isLoading) {
    return <LoadingState message="Crunching usage data…" />
  }

  if (error || !analytics) {
    return (
      <div className="p-3 text-sm text-destructive">
        Failed to load analytics: {String(error)}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <RightPanelHeader
        title="Analytics"
        actions={
          <Dialog open={fullYearDialogOpen} onOpenChange={setFullYearDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-[10px] h-5 px-1.5">
                Full year
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
                  Daily activity from the start of the year of the earliest data to the end of the year of the latest data.
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
                <Button onClick={() => setFullYearDialogOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="flex-1 p-3 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border p-2 min-w-0">
            <p className="text-[10px] text-muted-foreground truncate">Conversations</p>
            <p className="text-lg font-semibold truncate">{analytics.total_conversations}</p>
          </div>
          <div className="rounded-lg border border-border p-2 min-w-0">
            <p className="text-[10px] text-muted-foreground truncate">Messages</p>
            <p className="text-lg font-semibold truncate">{analytics.total_messages}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-2 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Token Usage</p>
          <div className="flex justify-between text-xs">
            <span>Input</span>
            <span className="font-mono">{analytics.token_usage.input_tokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Output</span>
            <span className="font-mono">{analytics.token_usage.output_tokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs font-medium pt-1 border-t">
            <span>Total</span>
            <span className="font-mono">{analytics.token_usage.total_tokens.toLocaleString()}</span>
          </div>
        </div>

        <div>
          <div className="overflow-x-auto">
            <AnalyticsHeatmap
              messagesData={currentMonthMessages}
              conversationsData={currentMonthConversations}
              startDate={currentMonthStart}
              endDate={currentMonthEnd}
              compact={true}
            />
          </div>
        </div>

        {analytics.skills_used.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Top Skills
            </h3>
            {analytics.skills_used.slice(0, 5).map(({ name, count }) => (
              <div key={name} className="flex justify-between text-xs min-w-0">
                <span className="truncate">{name}</span>
                <span className="font-mono shrink-0 ml-2">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
