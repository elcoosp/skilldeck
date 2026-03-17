// src/components/settings/skill-sources.tsx
// UX: Shows skill source resolution order so users understand why a local
// skill overrides a remote one.

import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  FolderOpen,
  Globe,
  Home,
  Plus,
  RefreshCw,
  Trash2
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useAddSkillSource,
  useRemoveSkillSource,
  useSkillsSources
} from '@/hooks/use-skills'
import type { SkillSourceInfo } from '@/lib/bindings'
import { cn } from '@/lib/utils'

export function SkillSources() {
  const { data: sources = [], isLoading, refetch } = useSkillsSources()
  const addSource = useAddSkillSource()
  const removeSource = useRemoveSkillSource()
  const queryClient = useQueryClient()

  const [showAdd, setShowAdd] = useState(false)
  const [newPath, setNewPath] = useState('')
  const [newLabel, setNewLabel] = useState('')

  // Sort sources by priority (lower number = higher priority)
  const sortedSources = [...sources].sort((a, b) => {
    // Priority is not stored in the API response, so we infer from source_type
    const priorityMap: Record<string, number> = {
      workspace: 1,
      personal: 2,
      registry: 3
    }
    const aPriority = priorityMap[a.source_type] ?? 999
    const bPriority = priorityMap[b.source_type] ?? 999
    return aPriority - bPriority
  })

  function handleAdd() {
    if (!newPath.trim()) return
    addSource.mutate(
      {
        sourceType: 'local_path',
        path: newPath.trim(),
        label: newLabel.trim() || undefined
      },
      {
        onSuccess: () => {
          setShowAdd(false)
          setNewPath('')
          setNewLabel('')
          toast.success('Skill source added')
        }
      }
    )
  }

  const handleRemove = (id: string) => {
    removeSource.mutate(id, {
      onSuccess: () => toast.success('Skill source removed')
    })
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['skill-sources'] })
    refetch()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Skill Source Directories</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Skills are resolved in priority order — sources listed earlier
            override later ones.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleRefresh}
          title="Refresh"
        >
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {/* Resolution order explanation */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-xs">
        <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">
          Resolution order
        </p>
        {[
          {
            icon: FolderOpen,
            label: 'Workspace (.skilldeck/skills/)',
            priority: 1
          },
          { icon: Home, label: 'Personal (~/.agents/skills/)', priority: 2 },
          { icon: Globe, label: 'Registry (platform)', priority: 3 }
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && (
              <ArrowDown className="size-3 text-muted-foreground ml-4" />
            )}
            <div className="flex items-center gap-1.5 ml-0">
              <item.icon className="size-3.5 text-muted-foreground" />
              <span>{item.label}</span>
              <span className="text-[10px] bg-primary/10 text-primary px-1 rounded">
                Priority {item.priority}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Source list */}
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading sources…</div>
      ) : (
        <div className="space-y-1.5">
          {sortedSources.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No custom sources added.
            </p>
          )}
          {sortedSources.map((source, index) => (
            <SourceRow
              key={source.id}
              source={source}
              priority={index + 1} // Display priority based on order
              onRemove={() => handleRemove(source.id)}
            />
          ))}
        </div>
      )}

      {/* Add new source */}
      {showAdd ? (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-xs font-medium">Add custom source</p>
          <Input
            placeholder="Path or URL"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            className="h-8 text-xs"
          />
          <Input
            placeholder="Label (optional)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleAdd}
              disabled={!newPath.trim() || addSource.isPending}
            >
              {addSource.isPending ? 'Adding...' : 'Add'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="size-3.5 mr-1.5" />
          Add Source
        </Button>
      )}
    </div>
  )
}

function SourceRow({
  source,
  priority,
  onRemove
}: {
  source: SkillSourceInfo
  priority: number
  onRemove: () => void
}) {
  const Icon = source.source_type === 'registry' ? Globe : FolderOpen

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
      <span className="text-[10px] font-medium text-muted-foreground w-6 shrink-0">
        #{priority}
      </span>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        {source.label && <p className="font-medium truncate">{source.label}</p>}
        <p
          className={cn(
            'font-mono truncate text-muted-foreground',
            source.label ? 'text-[10px]' : 'text-xs'
          )}
        >
          {source.path}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="size-3" />
      </Button>
    </div>
  )
}
