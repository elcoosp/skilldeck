// src/components/layout/mcp-tab.tsx
/**
 * McpTab — full MCP server management panel.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { openUrl } from '@tauri-apps/plugin-opener'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Server,
  Zap
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { AddMcpServerPayload, McpServerResponse } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import { cn } from '@/lib/utils'

import { CatalogCard } from './catalog-card'
import { CustomServerForm } from './custom-server-form'
import { LiveServerCard } from './live-server-card'

// Export types needed by child components
export interface CatalogEntry {
  id: string
  name: string
  description: string
  transport: 'stdio' | 'sse'
  command?: string
  args?: string[]
  url?: string
  docsUrl: string
  category:
    | 'filesystem'
    | 'web'
    | 'data'
    | 'dev'
    | 'productivity'
    | 'cloud'
    | 'observability'
  tags: string[]
}

// ── Catalog ───────────────────────────────────────────────────────────────────

const CATALOG: CatalogEntry[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read and write files on your local machine',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    docsUrl:
      'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    category: 'filesystem',
    tags: ['files', 'read', 'write']
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Persistent key-value memory across sessions',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    docsUrl:
      'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    category: 'data',
    tags: ['memory', 'persistence', 'kv']
  },
  {
    id: 'git',
    name: 'Git',
    description: 'Read git history, diffs, and commits locally',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-git', '--repository', '.'],
    docsUrl:
      'https://github.com/modelcontextprotocol/servers/tree/main/src/git',
    category: 'dev',
    tags: ['git', 'history', 'diff']
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Read repos, issues, PRs and files from GitHub',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    docsUrl:
      'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
    category: 'dev',
    tags: ['git', 'code', 'issues']
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Access GitLab projects, issues, and merge requests',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-gitlab'],
    docsUrl:
      'https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab',
    category: 'dev',
    tags: ['gitlab', 'ci/cd', 'mrs']
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Web and local search via Brave Search API',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    docsUrl:
      'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
    category: 'web',
    tags: ['search', 'web', 'browse']
  },
  {
    id: 'fetch',
    name: 'Fetch',
    description: 'Fetch any URL and convert to markdown',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-fetch'],
    docsUrl:
      'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
    category: 'web',
    tags: ['http', 'scrape', 'browse']
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    description: 'Browser automation and screenshot capture',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    docsUrl:
      'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
    category: 'web',
    tags: ['browser', 'automation', 'screenshot']
  },
  {
    id: 'playwright',
    name: 'Playwright',
    description: 'End-to-end testing and web automation',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-playwright'],
    docsUrl:
      'https://github.com/modelcontextprotocol/servers/tree/main/src/playwright',
    category: 'web',
    tags: ['testing', 'automation', 'e2e']
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Read-only access to PostgreSQL databases',
    transport: 'stdio',
    command: 'npx',
    args: [
      '-y',
      '@modelcontextprotocol/server-postgres',
      'postgresql://localhost/mydb'
    ],
    docsUrl:
      'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
    category: 'data',
    tags: ['sql', 'database', 'postgres']
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'Query and manage SQLite databases',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-sqlite', '--db-path', 'data.db'],
    docsUrl:
      'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
    category: 'data',
    tags: ['sql', 'database', 'query']
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    description: 'Query MongoDB collections using natural language',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-mongodb'],
    docsUrl:
      'https://github.com/modelcontextprotocol/servers/tree/main/src/mongodb',
    category: 'data',
    tags: ['nosql', 'document', 'aggregation']
  },
  {
    id: 'qdrant',
    name: 'Qdrant',
    description: 'Vector search for RAG and long-term memory',
    transport: 'stdio',
    command: 'docker',
    args: ['run', '-p', '6333:6333', 'qdrant/qdrant'],
    docsUrl: 'https://github.com/qdrant/qdrant-mcp-server',
    category: 'data',
    tags: ['vector', 'embeddings', 'memory']
  },
  {
    id: 'firebase',
    name: 'Firebase',
    description: 'Manage Firestore, Auth, Crashlytics, and more',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'firebase-tools', 'mcp'],
    docsUrl: 'https://github.com/firebase/firebase-tools',
    category: 'cloud',
    tags: ['firestore', 'auth', 'crashlytics']
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Query database, manage edge functions, generate types',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@supabase/mcp-server'],
    docsUrl: 'https://github.com/supabase/mcp-server',
    category: 'cloud',
    tags: ['postgres', 'auth', 'edge-functions']
  },
  {
    id: 'aws',
    name: 'AWS',
    description: 'Official AWS SDK integration for resource management',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@aws/mcp-server'],
    docsUrl: 'https://github.com/awslabs/mcp',
    category: 'cloud',
    tags: ['ec2', 's3', 'lambda']
  },
  {
    id: 'azure-devops',
    name: 'Azure DevOps',
    description: 'Manage work items, repos, pipelines, and wikis',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@azure/mcp-server-devops'],
    docsUrl: 'https://github.com/microsoft/mcp-server-devops',
    category: 'cloud',
    tags: ['azure', 'devops', 'pipelines']
  },
  {
    id: 'cloudflare-workers',
    name: 'Cloudflare Workers',
    description: 'Deploy and manage Workers, KV, and D1',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@cloudflare/mcp-server-workers'],
    docsUrl: 'https://github.com/cloudflare/mcp-server-workers',
    category: 'cloud',
    tags: ['workers', 'kv', 'd1']
  },
  {
    id: 'cloudflare-docs',
    name: 'Cloudflare Docs',
    description: 'Get up-to-date reference on Cloudflare products',
    transport: 'sse',
    url: 'https://docs.mcp.cloudflare.com/mcp',
    docsUrl:
      'https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/',
    category: 'cloud',
    tags: ['docs', 'cloudflare']
  },
  {
    id: 'cloudflare-observability',
    name: 'Cloudflare Observability',
    description: 'Debug applications with logs and analytics',
    transport: 'sse',
    url: 'https://observability.mcp.cloudflare.com/mcp',
    docsUrl:
      'https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/',
    category: 'observability',
    tags: ['logs', 'analytics', 'debug']
  },
  {
    id: 'cloudflare-radar',
    name: 'Cloudflare Radar',
    description: 'Global internet traffic insights and URL scans',
    transport: 'sse',
    url: 'https://radar.mcp.cloudflare.com/mcp',
    docsUrl:
      'https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/',
    category: 'web',
    tags: ['internet', 'traffic', 'trends']
  },
  {
    id: 'datadog',
    name: 'Datadog',
    description: 'Query metrics, logs, traces, and monitor incidents',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@datadog/mcp-server'],
    docsUrl: 'https://github.com/datadog/mcp-server',
    category: 'observability',
    tags: ['metrics', 'logs', 'apm']
  },
  {
    id: 'grafana',
    name: 'Grafana',
    description: 'Query dashboards, explore data sources',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@grafana/mcp-server'],
    docsUrl: 'https://github.com/grafana/mcp-server',
    category: 'observability',
    tags: ['dashboards', 'prometheus', 'loki']
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Access errors, issues, and performance data',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@sentry/mcp-server'],
    docsUrl: 'https://github.com/getsentry/sentry-mcp-server',
    category: 'observability',
    tags: ['errors', 'issues', 'performance']
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    description: 'Manage pods, deployments, services via kubectl',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@kubernetes/mcp-server'],
    docsUrl: 'https://github.com/kubernetes/mcp-server',
    category: 'dev',
    tags: ['k8s', 'pods', 'deployments']
  },
  {
    id: 'terraform',
    name: 'Terraform',
    description: 'Plan, apply, and query Terraform state',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@hashicorp/mcp-server-terraform'],
    docsUrl: 'https://github.com/hashicorp/mcp-server-terraform',
    category: 'dev',
    tags: ['iac', 'terraform', 'state']
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Read and send messages, search channels',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@slack/mcp-server'],
    docsUrl: 'https://github.com/slackapi/mcp-server-slack',
    category: 'productivity',
    tags: ['slack', 'messaging', 'team']
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Search, read, and write Notion pages',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@notionhq/mcp-server'],
    docsUrl: 'https://github.com/makenotion/notion-mcp-server',
    category: 'productivity',
    tags: ['wiki', 'docs', 'notes']
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Create, read, and update issues',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@atlassian/mcp-server-jira'],
    docsUrl: 'https://github.com/atlassian/mcp-server-jira',
    category: 'productivity',
    tags: ['tickets', 'project-mgmt']
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Extract design tokens and generate code from frames',
    transport: 'sse',
    url: 'https://mcp.figma.com/mcp',
    docsUrl: 'https://www.figma.com/developers/mcp',
    category: 'dev',
    tags: ['design', 'ui', 'code-gen']
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Query customers, subscriptions, and payments',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@stripe/mcp-server'],
    docsUrl: 'https://github.com/stripe/mcp-server',
    category: 'productivity',
    tags: ['payments', 'billing']
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Inspect deployments, logs, and env variables',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@vercel/mcp-server'],
    docsUrl: 'https://github.com/vercel/mcp-server',
    category: 'cloud',
    tags: ['deployments', 'logs', 'frontend']
  }
]

const CATEGORY_LABELS: Record<CatalogEntry['category'], string> = {
  filesystem: 'Filesystem',
  web: 'Web & Browser',
  data: 'Databases',
  dev: 'Development',
  productivity: 'Productivity',
  cloud: 'Cloud',
  observability: 'Observability'
}

const CATEGORY_ORDER: CatalogEntry['category'][] = [
  'filesystem',
  'dev',
  'web',
  'data',
  'cloud',
  'observability',
  'productivity'
]

// ── Main McpTab ───────────────────────────────────────────────────────────────

type McpView = 'servers' | 'catalog' | 'custom'

export function McpTab() {
  const [view, setView] = useState<McpView>('servers')
  const [addingId, setAddingId] = useState<string | null>(null)
  const [catalogCategory, setCatalogCategory] = useState<
    CatalogEntry['category'] | 'all'
  >('all')
  const qc = useQueryClient()

  const {
    data: servers = [],
    isLoading,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['mcp-servers'],
    queryFn: async () => {
      const res = await commands.listMcpServers()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 15_000,
    refetchInterval: 30_000
  })

  const addMut = useMutation({
    mutationFn: async (params: AddMcpServerPayload) => {
      const res = await commands.addMcpServer(params)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: ['mcp-servers'] })
      toast.success(`"${params.name}" added — connecting…`)
      setView('servers')
      setAddingId(null)
    },
    onError: (e: unknown) => {
      toast.error(`Failed to add: ${e}`)
      setAddingId(null)
    }
  })

  const addFromCatalog = (entry: CatalogEntry) => {
    setAddingId(entry.id)
    addMut.mutate({
      name: entry.name,
      transport: entry.transport,
      command: entry.command ?? null,
      args: entry.args ?? null,
      url: entry.url ?? null,
      env: null
    })
  }

  const addedNames = new Set(
    servers.map((s: McpServerResponse) => s.name.toLowerCase())
  )
  const isAdded = (entry: CatalogEntry) =>
    addedNames.has(entry.name.toLowerCase())
  const filteredCatalog =
    catalogCategory === 'all'
      ? CATALOG
      : CATALOG.filter((e) => e.category === catalogCategory)

  const handleBrowseAll = async () => {
    try {
      await openUrl('https://github.com/modelcontextprotocol/servers')
    } catch (e) {
      toast.error(`Failed to open link: ${e}`)
    }
  }
  const handleWhatIsMcp = async () => {
    try {
      await openUrl('https://modelcontextprotocol.io/introduction')
    } catch (e) {
      toast.error(`Failed to open link: ${e}`)
    }
  }

  // ── Catalog view ───────────────────────────────────────────────────────────

  if (view === 'catalog') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-border shrink-0">
          <button
            type="button"
            onClick={() => setView('servers')}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Back"
          >
            <ChevronRight className="size-4 rotate-180" />
          </button>
          <span className="text-xs font-semibold truncate">
            Popular MCP Servers
          </span>
          <button
            type="button"
            onClick={handleBrowseAll}
            className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            All <ExternalLink className="size-3" />
          </button>
        </div>

        {/* Category filter row - now horizontally scrollable */}
        <div className="shrink-0 overflow-hidden px-3 py-2">
          <div className="flex gap-1 overflow-x-auto whitespace-nowrap pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {(['all', ...CATEGORY_ORDER] as const).map((cat) => (
              <button
                type="button"
                key={cat}
                onClick={() => setCatalogCategory(cat)}
                className={cn(
                  'shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap',
                  catalogCategory === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-3 pb-3 space-y-1.5 overflow-hidden">
            {filteredCatalog.map((entry) => (
              <CatalogCard
                key={entry.id}
                entry={entry}
                alreadyAdded={isAdded(entry)}
                onAdd={addFromCatalog}
                adding={addingId === entry.id && addMut.isPending}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    )
  }

  // ── Custom server view ─────────────────────────────────────────────────────

  if (view === 'custom') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-border shrink-0">
          <button
            type="button"
            onClick={() => setView('servers')}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Back"
          >
            <ChevronRight className="size-4 rotate-180" />
          </button>
          <span className="text-xs font-semibold">Add Custom Server</span>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3">
            <CustomServerForm onSuccess={() => setView('servers')} />
          </div>
        </ScrollArea>
      </div>
    )
  }

  // ── Server list view (default) ─────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          MCP Servers
        </span>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          title="Refresh"
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          <RefreshCw className={cn('size-3', isFetching && 'animate-spin')} />
        </button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 pb-3 space-y-2 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : servers.length === 0 ? (
            // ✨ Whimsical empty state with fade+scale animation
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex flex-col items-center justify-center py-12 px-4 text-center"
            >
              <div className="w-48 h-48 mb-4 overflow-hidden rounded-3xl">
                <img
                  src="/illustrations/empty-mcp.jpeg"
                  alt="No MCP servers"
                  className="w-full h-full object-cover opacity-90"
                />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Your agent needs friends.
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Add an MCP server to give it new tools—like a brain with extra
                senses.
              </p>
            </motion.div>
          ) : (
            servers.map((server: McpServerResponse) => (
              <LiveServerCard key={server.id} server={server} />
            ))
          )}

          {servers.length > 0 && (
            <div className="flex items-center gap-3 px-1 pt-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-green-500 inline-block" />
                {
                  servers.filter(
                    (s: McpServerResponse) => s.status === 'connected'
                  ).length
                }{' '}
                connected
              </span>
              <span>
                {servers.reduce(
                  (n: number, s: McpServerResponse) => n + s.tools.length,
                  0
                )}{' '}
                tools
              </span>
            </div>
          )}

          <div className="border-t border-border/50 my-2" />

          <button
            type="button"
            onClick={() => setView('catalog')}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border hover:border-primary/40 hover:bg-muted/30 text-left transition-colors group"
          >
            <div className="size-7 rounded-md bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
              <Zap className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium">Browse catalog</p>
              <p className="text-[11px] text-muted-foreground">
                {CATALOG.length} servers — one click to add
              </p>
            </div>
            <ChevronRight className="size-3.5 text-muted-foreground ml-auto shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setView('custom')}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border hover:border-primary/40 hover:bg-muted/30 text-left transition-colors group"
          >
            <div className="size-7 rounded-md bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
              <Server className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium">Add custom server</p>
              <p className="text-[11px] text-muted-foreground">
                stdio or SSE, any command or URL
              </p>
            </div>
            <ChevronRight className="size-3.5 text-muted-foreground ml-auto shrink-0" />
          </button>

          <button
            type="button"
            onClick={handleWhatIsMcp}
            className="flex items-center gap-1.5 px-1 pt-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="size-3 shrink-0" />
            What is MCP?
          </button>
        </div>
      </ScrollArea>
    </div>
  )
}
