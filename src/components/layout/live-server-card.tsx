// src/components/layout/live-server-card.tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronRight,
  Loader2,
  PlugZap,
  Server,
  Trash2,
  Unplug
} from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import type { McpServerResponse, McpToolResponse } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import { cn } from '@/lib/utils'

interface LiveServerCardProps {
  server: McpServerResponse
}

function StatusBadge({ status }: { status: McpServerResponse['status'] }) {
  return (
    <Badge
      variant={
        status === 'connected'
          ? 'default'
          : status === 'error'
            ? 'destructive'
            : 'secondary'
      }
      className={cn(
        'text-[10px] h-4 px-1.5 min-w-0 overflow-hidden',
        status === 'connected' &&
        'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20'
      )}
    >
      <span className="flex items-center gap-1 min-w-0 overflow-hidden">
        {status === 'connected' && (
          <span className="size-1.5 rounded-full bg-green-500 shrink-0" />
        )}
        <span className="truncate">{status}</span>
      </span>
    </Badge>
  )
}

function StatusDot({ status }: { status: McpServerResponse['status'] }) {
  const color =
    status === 'connected'
      ? 'bg-green-500'
      : status === 'error'
        ? 'bg-destructive'
        : 'bg-muted-foreground'

  const label =
    status === 'connected' ? 'Connected' : status === 'error' ? 'Error' : 'Disconnected'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center shrink-0',
            color,
            'size-2 rounded-full'
          )}
        />
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

export function LiveServerCard({ server }: LiveServerCardProps) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)

  const connectMut = useMutation({
    mutationFn: async () => {
      const res = await commands.connectMcpServer(server.id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mcp-servers'] })
      toast.success(`Connected to ${server.name}`)
    },
    onError: (e: unknown) => toast.error(`Connect failed: ${e}`)
  })

  const disconnectMut = useMutation({
    mutationFn: async () => {
      const res = await commands.disconnectMcpServer(server.id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mcp-servers'] })
      toast.info(`Disconnected from ${server.name}`)
    },
    onError: (e: unknown) => toast.error(`Disconnect failed: ${e}`)
  })

  const removeMut = useMutation({
    mutationFn: async () => {
      const res = await commands.removeMcpServer(server.id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mcp-servers'] })
      toast.success(`Removed ${server.name}`)
    },
    onError: (e: unknown) => toast.error(`Remove failed: ${e}`)
  })

  const isConnected = server.status === 'connected'
  const isBusy =
    connectMut.isPending || disconnectMut.isPending || removeMut.isPending

  return (
    <TooltipProvider>
      <div className="@container/live rounded-lg border border-border bg-card overflow-hidden min-w-0">
        <div className="flex items-center gap-2 px-3 py-2 min-w-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0"
          >
            <ChevronRight
              className={cn(
                'size-3 text-muted-foreground transition-transform duration-150',
                expanded && 'rotate-90'
              )}
            />
          </button>

          <Server className="size-3.5 text-muted-foreground shrink-0" />

          {/* Name + responsive status indicator with flex-wrap */}
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="text-xs font-medium truncate min-w-0 flex-1">
              {server.name}
            </span>

            {/* Dot (narrow containers) */}
            <div className="@[200px]/live:hidden inline-flex">
              <StatusDot status={server.status} />
            </div>

            {/* Full badge (wide containers) */}
            <div className="hidden @[200px]/live:inline-flex">
              <StatusBadge status={server.status} />
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {isConnected ? (
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => disconnectMut.mutate()}
                disabled={isBusy}
                title="Disconnect"
              >
                {isBusy ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Unplug className="size-3" />
                )}
              </Button>
            ) : (
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => connectMut.mutate()}
                disabled={isBusy}
                title="Connect"
              >
                {isBusy ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <PlugZap className="size-3" />
                )}
              </Button>
            )}
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => removeMut.mutate()}
              disabled={isBusy}
              title="Remove server"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>

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
                {server.tools.map((tool: McpToolResponse) => (
                  <div key={tool.name} className="text-[11px] min-w-0">
                    <span className="font-mono text-foreground break-all">
                      {tool.name}
                    </span>
                    {tool.description && (
                      <p className="text-muted-foreground mt-0.5 leading-relaxed break-words">
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
    </TooltipProvider>
  )
}
