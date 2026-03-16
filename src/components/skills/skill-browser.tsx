// src/components/skills/skill-browser.tsx
// Main skill browser — grid view with search, category filter, and detail panel.

import { useState, useMemo } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SkillCard } from './skill-card'
import { SkillDetail } from './skill-detail'
import { useAllSkills, useSyncRegistry } from '@/hooks/use-skills'
import type { RegistrySkillData } from '@/lib/bindings'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  'All',
  'Development',
  'Data',
  'Writing',
  'DevOps',
  'Security',
  'Research',
  'Productivity',
  'Other'
]

export function SkillBrowser({ className }: { className?: string }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [selectedSkill, setSelectedSkill] = useState<RegistrySkillData | null>(null)

  const { skills, isLoading, isError } = useAllSkills({
    category: category === 'All' ? undefined : category,
    search: search || undefined
  })

  const sync = useSyncRegistry()

  // Client-side filter on top of server-side filtering.
  const filtered = useMemo(() => {
    if (!search && category === 'All') return skills
    return skills.filter((s) => {
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())
      const matchCat =
        category === 'All' ||
        ('category' in s && s.category === category)
      return matchSearch && matchCat
    })
  }, [skills, search, category])

  if (selectedSkill) {
    return (
      <SkillDetail
        skill={selectedSkill}
        className={className}
        onBack={() => setSelectedSkill(null)}
      />
    )
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills…"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="text-xs">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          title="Sync from registry"
        >
          <RefreshCw
            className={cn('size-3.5', sync.isPending && 'animate-spin')}
          />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {isLoading && (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              <div className="animate-spin size-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
              Loading skills…
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-sm text-muted-foreground">
              <p>Failed to load skills.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => sync.mutate()}
              >
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !isError && filtered.length === 0 && (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              No skills found
              {search && ` for "${search}"`}.
            </div>
          )}

          {!isLoading && !isError && filtered.length > 0 && (
            <div className="grid grid-cols-1 gap-2">
              {filtered.map((skill) => {
                // Narrow to RegistrySkillData for display.
                if (skill._sourceType === 'registry') {
                  return (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onSelect={() => setSelectedSkill(skill)}
                    />
                  )
                }
                // Local skill — show a simplified card.
                return (
                  <LocalSkillRow
                    key={skill.name}
                    name={skill.name}
                    description={skill.description}
                    source={skill.source}
                    isActive={skill.is_active}
                  />
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer summary */}
      <div className="px-3 py-1.5 border-t border-border text-[11px] text-muted-foreground shrink-0">
        {filtered.length} skill{filtered.length !== 1 ? 's' : ''}
        {filtered.length !== skills.length && ` (filtered from ${skills.length})`}
      </div>
    </div>
  )
}

// ── Local skill row ───────────────────────────────────────────────────────────

function LocalSkillRow({
  name,
  description,
  source,
  isActive
}: {
  name: string
  description: string
  source: string
  isActive: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{name}</span>
          <span className="text-[10px] bg-muted rounded-full px-1.5 py-0.5 text-muted-foreground">
            {source}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{description}</p>
      </div>
      <span
        className={cn(
          'text-[11px] font-medium rounded-full px-2 py-0.5',
          isActive
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isActive ? 'Active' : 'Inactive'}
      </span>
    </div>
  )
}
