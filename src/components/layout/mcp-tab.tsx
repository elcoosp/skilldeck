/**
 * McpTab — full MCP server management panel.
 *
 * Replaces the single "No MCP servers configured." dead-end with:
 *  1. Live server list with status badges + connect/disconnect/remove actions
 *  2. Curated catalog of popular MCP servers with one-click add
 *  3. Custom server form (stdio or SSE)
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Package,
  Plus,
  PlugZap,
  PlugZapIcon,
  RefreshCw,
  Server,
  Trash2,
  Unplug,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  listMcpServers,
  connectMcpServer,
  disconnectMcpServer,
  addMcpServer,
  removeMcpServer,
  type McpServer,
  type AddMcpServerParams,
} from '@/lib/invoke'

// ── Catalog ───────────────────────────────────────────────────────────────────

interface CatalogEntry {
  id: string
  name: string
  description: string
  transport: 'stdio' | 'sse'
  command?: string
  args?: string[]
  url?: string
  docsUrl: string
  category: 'filesystem' | 'web' | 'data' | 'dev' | 'productivity'
  tags: string[]
}

const CATALOG: CatalogEntry[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read and write files on your local machine',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    category: 'filesystem',
    tags: ['files', 'read', 'write'],
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Persistent key-value memory across sessions',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    category: 'data',
    tags: ['memory', 'persistence', 'kv'],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Read repos, issues, PRs and files from GitHub',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
    category: 'dev',
    tags: ['git', 'code', 'issues', 'prs'],
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Web and local search via Brave Search API',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
    category: 'web',
    tags: ['search', 'web', 'browse'],
  },
  {
    id: 'fetch',
    name: 'Fetch',
    description: 'Fetch any URL and convert to markdown',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-fetch'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
    category: 'web',
    tags: ['http', 'scrape', 'browse'],
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'Query and manage SQLite databases',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-sqlite', '--db-path', 'data.db'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
    category: 'data',
    tags: ['sql', 'database', 'query'],
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Read-only access to PostgreSQL databases',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
    category: 'data',
    tags: ['sql', 'database', 'postgres'],
  },
  {
    id: 'git',
    name: 'Git',
    description: 'Read git history, diffs, and commits locally',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-git', '--repository', '.'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git',
    category: 'dev',
    tags: ['git', 'history', 'diff'],
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    description: 'Browser automation and screenshot capture',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
    category: 'web',
    tags: ['browser', 'automation', 'screenshot'],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Read and send messages in Slack workspaces',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack',
    category: 'productivity',
    tags: ['slack', 'messaging', 'team'],
  },
  {
    id: 'everything',
    name: 'Everything (demo)',
    description: 'Demo server that exposes every MCP capability',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/everything',
    category: 'dev',
    tags: ['demo', 'testing', 'all'],
  },
]

const CATEGORY_LABELS: Record<CatalogEntry['category'], string> = {
  filesystem: 'Filesystem',
  web: 'Web & Browser',
  data: 'Databases',
  dev: 'Development',
  productivity: 'Productivity',
}

const CATEGORY_ORDER: CatalogEntry['category'][] = [
  'filesystem', 'dev', 'web', 'data', 'productivity',
]

// ── Status helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: McpServer['status'] }) {
  return (
    <Badge
      variant={status === 'connected' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}
      className={cn(
        'text-[10px] h-4 px-1.5',
        status === 'connected' && 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20',
      )}
    >
      {status === 'connected' && (
        <span className="size-1.5 rounded-full bg-green-500 mr-1 shrink-0 inline-block" />
      )}
      {status}
    </Badge>
  )
}

// ── Live server card ──────────────────────────────────────────────────────────

function LiveServerCard({ server }: { server: McpServer }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)

  const connectMut = useMutation({
    mutationFn: () => connectMcpServer(server.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mcp-servers'] })
      toast.success(`Connected to ${server.name}`)
    },
    onError: (e: unknown) => toast.error(`Connect failed: ${e}`),
  })

  const disconnectMut = useMutation({
    mutationFn: () => disconnectMcpServer(server.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mcp-servers'] })
      toast.info(`Disconnected from ${server.name}`)
    },
    onError: (e: unknown) => toast.error(`Disconnect failed: ${e}`),
  })

  const removeMut = useMutation({
    mutationFn: () => removeMcpServer(server.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mcp-servers'] })
      toast.success(`Removed ${server.name}`)
    },
    onError: (e: unknown) => toast.error(`Remove failed: ${e}`),
  })

  const isConnected = server.status === 'connected'
  const isBusy = connectMut.isPending || disconnectMut.isPending || removeMut.isPending

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          <span className={cn(
            'transition-transform duration-150',
            expanded ? 'rotate-90' : 'rotate-0'
          )}>
            <ChevronRight className="size-3 text-muted-foreground" />
          </span>
          <Server className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium truncate">{server.name}</span>
        </button>

        <StatusBadge status={server.status} />

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {isConnected ? (
            <button
              onClick={() => disconnectMut.mutate()}
              disabled={isBusy}
              title="Disconnect"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              {isBusy ? <Loader2 className="size-3 animate-spin" /> : <Unplug className="size-3" />}
            </button>
          ) : (
            <button
              onClick={() => connectMut.mutate()}
              disabled={isBusy}
              title="Connect"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              {isBusy ? <Loader2 className="size-3 animate-spin" /> : <PlugZap className="size-3" />}
            </button>
          )}
          <button
            onClick={() => removeMut.mutate()}
            disabled={isBusy}
            title="Remove server"
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      {/* Expanded: tools list */}
      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-1.5">
          {server.tools.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {isConnected ? 'No tools exposed.' : 'Connect to discover tools.'}
            </p>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {server.tools.length} tool{server.tools.length !== 1 ? 's' : ''}
              </p>
              {server.tools.map(tool => (
                <div key={tool.name} className="text-[11px]">
                  <span className="font-mono text-foreground">{tool.name}</span>
                  {tool.description && (
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                      {tool.description}
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Catalog card ──────────────────────────────────────────────────────────────

function CatalogCard({
  entry,
  alreadyAdded,
  onAdd,
  adding,
}: {
  entry: CatalogEntry
  alreadyAdded: boolean
  onAdd: (entry: CatalogEntry) => void
  adding: boolean
}) {
  return (
    <div className={cn(
      'flex items-start gap-2.5 px-3 py-2.5 rounded-lg border transition-colors',
      alreadyAdded
        ? 'border-green-500/20 bg-green-500/5 opacity-70'
        : 'border-border hover:border-primary/30 hover:bg-muted/30',
    )}>
      <Package className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-medium">{entry.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded">
            {entry.transport}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {entry.description}
        </p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {entry.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1 shrink-0 items-end">
        <button
          onClick={() => !alreadyAdded && onAdd(entry)}
          disabled={alreadyAdded || adding}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors',
            alreadyAdded
              ? 'text-green-600 dark:text-green-400 cursor-default'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50',
          )}
        >
          {adding ? <Loader2 className="size-3 animate-spin" /> :
            alreadyAdded ? '✓ Added' : <><Plus className="size-2.5" />Add</>}
        </button>
        <a
          href={entry.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Docs <ExternalLink className="size-2.5" />
        </a>
      </div>
    </div>
  )
}

// ── Custom server form ────────────────────────────────────────────────────────

type FormTransport = 'stdio' | 'sse'

interface CustomFormState {
  name: string
  transport: FormTransport
  command: string
  args: string
  url: string
  env: string
}

function CustomServerForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<CustomFormState>({
    name: '',
    transport: 'stdio',
    command: 'npx',
    args: '',
    url: '',
    env: '',
  })

  const addMut = useMutation({
    mutationFn: (params: AddMcpServerParams) => addMcpServer(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mcp-servers'] })
      toast.success(`MCP server "${form.name}" added`)
      onSuccess()
    },
    onError: (e: unknown) => toast.error(`Failed to add server: ${e}`),
  })

  const setField = (key: keyof CustomFormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [key]: e.target.value }))

  const submit = () => {
    if (!form.name.trim()) {
      toast.error('Server name is required')
      return
    }
    if (form.transport === 'stdio' && !form.command.trim()) {
      toast.error('Command is required for stdio transport')
      return
    }
    if (form.transport === 'sse' && !form.url.trim()) {
      toast.error('URL is required for SSE transport')
      return
    }

    let env: Record<string, string> | undefined
    if (form.env.trim()) {
      try {
        env = JSON.parse(form.env)
      } catch {
        toast.error('Env must be valid JSON, e.g. {"KEY": "value"}')
        return
      }
    }

    addMut.mutate({
      name: form.name.trim(),
      transport: form.transport,
      command: form.transport === 'stdio' ? form.command.trim() : undefined,
      args: form.transport === 'stdio' && form.args.trim()
        ? form.args.trim().split(/\s+/)
        : undefined,
      url: form.transport === 'sse' ? form.url.trim() : undefined,
      env,
    })
  }

  const inp = 'w-full h-7 rounded-md border border-input bg-background px-2.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

  return (
    <div className="space-y-2.5">
      <div>
        <label className="block text-[11px] text-muted-foreground mb-1">Name</label>
        <input className={inp} placeholder="my-server" value={form.name} onChange={setField('name')} />
      </div>

      <div>
        <label className="block text-[11px] text-muted-foreground mb-1">Transport</label>
        <select
          className={inp}
          value={form.transport}
          onChange={setField('transport')}
        >
          <option value="stdio">stdio (local process)</option>
          <option value="sse">SSE (HTTP endpoint)</option>
        </select>
      </div>

      {form.transport === 'stdio' ? (
        <>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Command</label>
            <input className={inp} placeholder="npx" value={form.command} onChange={setField('command')} />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">
              Arguments <span className="opacity-60">(space-separated)</span>
            </label>
            <input
              className={inp}
              placeholder="-y @modelcontextprotocol/server-filesystem ."
              value={form.args}
              onChange={setField('args')}
            />
          </div>
        </>
      ) : (
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">URL</label>
          <input className={inp} placeholder="http://localhost:8080/sse" value={form.url} onChange={setField('url')} />
        </div>
      )}

      <div>
        <label className="block text-[11px] text-muted-foreground mb-1">
          Env vars <span className="opacity-60">(optional JSON)</span>
        </label>
        <input
          className={inp}
          placeholder='{"GITHUB_TOKEN": "ghp_..."}'
          value={form.env}
          onChange={setField('env')}
        />
      </div>

      <button
        onClick={submit}
        disabled={addMut.isPending}
        className="w-full h-7 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
      >
        {addMut.isPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
        Add Server
      </button>
    </div>
  )
}

// ── Main McpTab ───────────────────────────────────────────────────────────────

type McpView = 'servers' | 'catalog' | 'custom'

export function McpTab() {
  const [view, setView] = useState<McpView>('servers')
  const [addingId, setAddingId] = useState<string | null>(null)
  const [catalogCategory, setCatalogCategory] = useState<CatalogEntry['category'] | 'all'>('all')
  const qc = useQueryClient()

  const { data: servers = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['mcp-servers'],
    queryFn: listMcpServers,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const addMut = useMutation({
    mutationFn: (params: AddMcpServerParams) => addMcpServer(params),
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: ['mcp-servers'] })
      toast.success(`"${params.name}" added — connecting…`)
      setView('servers')
      setAddingId(null)
    },
    onError: (e: unknown) => {
      toast.error(`Failed to add: ${e}`)
      setAddingId(null)
    },
  })

  const addFromCatalog = (entry: CatalogEntry) => {
    setAddingId(entry.id)
    addMut.mutate({
      name: entry.name,
      transport: entry.transport,
      command: entry.command,
      args: entry.args,
      url: entry.url,
    })
  }

  const addedNames = new Set(servers.map(s => s.name.toLowerCase()))
  const isAdded = (entry: CatalogEntry) => addedNames.has(entry.name.toLowerCase())

  const filteredCatalog = catalogCategory === 'all'
    ? CATALOG
    : CATALOG.filter(e => e.category === catalogCategory)

  // ── Sub-views ──────────────────────────────────────────────────────────────

  if (view === 'catalog') {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-border shrink-0">
          <button
            onClick={() => setView('servers')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back"
          >
            <ChevronRight className="size-4 rotate-180" />
          </button>
          <span className="text-xs font-semibold">Popular MCP Servers</span>
          <a
            href="https://github.com/modelcontextprotocol/servers"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Browse all <ExternalLink className="size-3" />
          </a>
        </div>

        {/* Category filter */}
        <div className="flex gap-1 px-3 py-2 overflow-x-auto shrink-0 scrollbar-none">
          {(['all', ...CATEGORY_ORDER] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setCatalogCategory(cat)}
              className={cn(
                'shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap',
                catalogCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-3 pb-3 space-y-1.5">
            {filteredCatalog.map(entry => (
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

  if (view === 'custom') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-border shrink-0">
          <button
            onClick={() => setView('servers')}
            className="text-muted-foreground hover:text-foreground transition-colors"
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

  // ── Default: server list view ──────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          MCP Servers
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh"
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('size-3', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 pb-3 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : servers.length === 0 ? (
            /* ── Empty state ── */
            <div className="flex flex-col items-center text-center gap-3 pt-4 pb-2">
              <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
                <PlugZapIcon className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium mb-1">No tools configured – add a server and unleash the magic!</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[180px]">
                  MCP servers give the agent tools like file access, web search, and database queries.
                </p>
              </div>
            </div>
          ) : (
            servers.map(server => (
              <LiveServerCard key={server.id} server={server} />
            ))
          )}

          {/* Stats bar when servers exist */}
          {servers.length > 0 && (
            <div className="flex items-center gap-3 px-1 pt-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-green-500 inline-block" />
                {servers.filter(s => s.status === 'connected').length} connected
              </span>
              <span>
                {servers.reduce((n, s) => n + s.tools.length, 0)} tools total
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border/50 my-2" />

          {/* Action buttons — always visible */}
          <button
            onClick={() => setView('catalog')}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border hover:border-primary/40 hover:bg-muted/30 text-left transition-colors group"
          >
            <div className="size-7 rounded-md bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
              <Zap className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-xs font-medium">Browse catalog</p>
              <p className="text-[11px] text-muted-foreground">
                {CATALOG.length} popular servers — one click to add
              </p>
            </div>
            <ChevronRight className="size-3.5 text-muted-foreground ml-auto shrink-0" />
          </button>

          <button
            onClick={() => setView('custom')}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border hover:border-primary/40 hover:bg-muted/30 text-left transition-colors group"
          >
            <div className="size-7 rounded-md bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
              <Server className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-xs font-medium">Add custom server</p>
              <p className="text-[11px] text-muted-foreground">
                stdio or SSE, any command or URL
              </p>
            </div>
            <ChevronRight className="size-3.5 text-muted-foreground ml-auto shrink-0" />
          </button>

          {/* Learn more link */}
          <a
            href="https://modelcontextprotocol.io/introduction"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-1 pt-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="size-3" />
            What is MCP?
          </a>
        </div>
      </ScrollArea>
    </div>
  )
}
