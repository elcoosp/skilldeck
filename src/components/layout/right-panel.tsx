/**
 * Right panel — tabbed session context: Session, Skills, MCP, Workflow, Analytics.
 *
 * Tab bar shows icons only. On hover the label fades in and smoothly pushes
 * sibling icons apart via a max-width transition (no layout jumps).
 *
 * Skills tab now renders the UnifiedSkillList — a virtualized marketplace that
 * merges local and registry skills into a single high-performance grid.
 */

import { useState } from 'react';
import {
  BarChart2,
  ChevronRight,
  Cpu,
  GitBranch,
  Layers,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';  // <-- added
import { cn } from '@/lib/utils';
import { useConversations } from '@/hooks/use-conversations';
import { useProfiles } from '@/hooks/use-profiles';
import { useUIStore } from '@/store/ui';

import { BouncingDots } from '@/components/ui/bouncing-dots';
import { useWorkflowEvents } from '@/hooks/use-workflow-events';
import { useWorkflowDefinitions, useDeleteWorkflowDefinition } from '@/hooks/use-workflow-definitions';
import { WorkflowEditor } from '@/components/workflow/workflow-editor';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { commands } from '@/lib/bindings';
import { McpTab } from './mcp-tab';
import { toast } from 'sonner';
import { UnifiedSkillList } from '@/components/skills/unified-skill-list';

type Tab = 'session' | 'skills' | 'mcp' | 'workflow' | 'analytics';

const TABS: {
  id: Tab;
  label: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
    { id: 'session', label: 'Session', Icon: Cpu },
    { id: 'skills', label: 'Skills', Icon: Layers },
    { id: 'mcp', label: 'MCP', Icon: Zap },
    { id: 'workflow', label: 'Workflow', Icon: GitBranch },
    { id: 'analytics', label: 'Analytics', Icon: BarChart2 },
  ];

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('session');
  const activeConversationId = useUIStore((s) => s.activeConversationId);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar — icon-only by default; label slides in on hover */}
      <div className="flex border-b border-border shrink-0">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'group flex items-center justify-center gap-0 px-2 py-2.5 text-xs font-medium',
              'transition-all duration-200',
              'overflow-hidden min-w-0',
              'flex-none',
              activeTab === id
                ? 'text-foreground border-b-2 border-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            <span
              className={cn(
                'whitespace-nowrap overflow-hidden',
                'max-w-0 group-hover:max-w-32',
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
          {activeTab === 'session' && <SessionTab conversationId={activeConversationId} />}
          {activeTab === 'workflow' && <WorkflowTab />}
          {activeTab === 'analytics' && <AnalyticsTab />}
        </ScrollArea>
      )}
    </div>
  );
}

// ── Session tab ───────────────────────────────────────────────────────────────

function useAvailableModels(provider: string) {
  return useQuery({
    queryKey: ['available-models', provider],
    queryFn: async (): Promise<string[]> => {
      if (provider === 'ollama') {
        const res = await commands.listOllamaModels();
        if (res.status === 'ok') return res.data.map((m) => m.id);
        throw new Error(res.error);
      }
      if (provider === 'claude') {
        return ['claude-sonnet-4-5', 'claude-opus-4', 'claude-3-5-sonnet'];
      }
      if (provider === 'openai') {
        return ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      }
      return [];
    },
    staleTime: 60_000,
  });
}

function SessionTab({ conversationId }: { conversationId: string | null }) {
  // Get profiles and default profile to pass to conversations query
  const { data: profiles } = useProfiles();
  const defaultProfile = profiles?.find((p) => p.is_default) ?? profiles?.[0];

  // Pass profileId to useConversations() so it uses the SAME query key as left-panel
  const {
    data: conversations,
    isLoading: conversationsLoading,
    refetch
  } = useConversations(defaultProfile?.id);

  const { data: keyStatuses = [] } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const res = await commands.listApiKeys();
      if (res.status === 'ok') return res.data;
      throw new Error(res.error);
    },
    staleTime: 30_000,
  });

  if (!conversationId) {
    return <div className="p-4 text-xs text-muted-foreground">No active conversation.</div>;
  }

  if (conversationsLoading) {
    return (
      <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
        <div className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading conversations...
      </div>
    );
  }

  const conversation = conversations?.find((c) => c.id === conversationId);

  if (!conversation) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Conversation not found. It may still be loading or may have been deleted.
        </p>
        <div className="flex gap-2">
          <Button size="xs" variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  const profile = profiles?.find((p) => p.id === conversation.profile_id);
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
    );
  }

  const hasKeyForProvider = (p: string) => keyStatuses.find((k) => k.provider === p)?.has_key ?? false;
  const effectiveProvider = hasKeyForProvider(profile.model_provider)
    ? profile.model_provider
    : 'ollama';
  const isUsingFallback = effectiveProvider !== profile.model_provider;

  return (
    <div className="p-4 space-y-4">
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Active Conversation
        </h3>
        <p className="text-xs font-mono text-muted-foreground break-all">{conversationId}</p>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Profile & Model
        </h3>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Provider</label>
          <div className="text-xs font-medium px-2 py-1 rounded bg-muted/50 flex items-center gap-1.5">
            {effectiveProvider}
            {isUsingFallback && (
              <span className="text-[10px] text-amber-500 font-normal" title={`No API key found for ${profile.model_provider}. Using local Ollama instead.`}>
                (fallback)
              </span>
            )}
          </div>
        </div>

        <ModelSelector provider={effectiveProvider} currentModelId={profile.model_id} />
      </section>
    </div>
  );
}

function ModelSelector({ provider, currentModelId }: { provider: string; currentModelId: string }) {
  const { data: models = [], isLoading } = useAvailableModels(provider);
  const [selected, setSelected] = useState(currentModelId);
  const displayModels = models.length > 0 ? models : [currentModelId];
  const safeSelected = displayModels.includes(selected) ? selected : displayModels[0];

  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">
        Model {isLoading && <span className="opacity-50">(loading…)</span>}
      </label>
      <Select value={safeSelected} onValueChange={setSelected}>
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
  );
}

// ── Workflow tab ──────────────────────────────────────────────────────────────

function WorkflowTab() {
  const { progress } = useWorkflowEvents();
  const { data: savedWorkflows = [], isLoading } = useWorkflowDefinitions();
  const deleteWorkflow = useDeleteWorkflowDefinition();
  const [editorOpen, setEditorOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete workflow "${name}"?`)) {
      deleteWorkflow.mutate(id, {
        onSuccess: () => toast.success('Workflow deleted'),
        onError: (err) => toast.error('Failed to delete: ' + err),
      });
    }
  };

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

          <p className="text-xs font-mono text-muted-foreground break-all">{progress.workflowId}</p>

          {progress.error && (
            <div className="p-2 rounded-md bg-red-500/10 text-xs text-red-500">{progress.error}</div>
          )}

          <div className="space-y-1">
            {Object.values(progress.steps).map((step) => {
              const isOpen = expanded[step.stepId];
              const stepColor = {
                pending: 'bg-muted-foreground/30',
                running: 'bg-blue-500 animate-pulse',
                completed: 'bg-green-500',
                failed: 'bg-red-500',
              }[step.status];

              return (
                <div key={step.stepId} className="rounded-md border border-border overflow-hidden">
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full p-2 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => setExpanded((prev) => ({ ...prev, [step.stepId]: !isOpen }))}
                  >
                    <div className={cn('size-2 rounded-full shrink-0', stepColor)} />
                    <span className="text-xs font-medium flex-1 truncate">{step.stepId}</span>
                    <span className="text-xs text-muted-foreground">{step.status}</span>
                    <ChevronRight
                      className={cn('size-3 text-muted-foreground transition-transform', isOpen && 'rotate-90')}
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
              );
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
          <Button size="xs" variant="outline" onClick={() => setEditorOpen(true)}>
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
              Design a workflow that turns complex tasks into elegant automation.
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
  );
}

// ── Analytics tab ─────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const mockWeeklyTokens = [
    { day: 'Mon', tokens: 12400 },
    { day: 'Tue', tokens: 8900 },
    { day: 'Wed', tokens: 23100 },
    { day: 'Thu', tokens: 5600 },
    { day: 'Fri', tokens: 18700 },
    { day: 'Sat', tokens: 3200 },
    { day: 'Sun', tokens: 9800 },
  ];
  const maxTokens = Math.max(...mockWeeklyTokens.map((d) => d.tokens));

  return (
    <div className="p-4 space-y-5">
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Token Usage — This Week
        </h3>
        <div className="flex items-end gap-1 h-20">
          {mockWeeklyTokens.map(({ day, tokens }) => (
            <div key={day} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-primary/60 transition-all"
                style={{ height: `${(tokens / maxTokens) * 100}%` }}
              />
              <span className="text-[9px] text-muted-foreground">{day}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-right">
          Total: {mockWeeklyTokens.reduce((a, b) => a + b.tokens, 0).toLocaleString()} tokens
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Provider Breakdown
        </h3>
        {[
          { label: 'Claude', pct: 62, color: 'bg-violet-500' },
          { label: 'Ollama', pct: 28, color: 'bg-blue-500' },
          { label: 'OpenAI', pct: 10, color: 'bg-green-500' },
        ].map(({ label, pct, color }) => (
          <div key={label} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground/60 text-center">
        Analytics data is approximate. Detailed usage tracking coming in v1.1.
      </p>
    </div>
  );
}
