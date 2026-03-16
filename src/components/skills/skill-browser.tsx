// src/components/skills/skill-browser.tsx
// Main skill browser — grid view with search, category filter, and detail panel.

import { useState, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SkillCard } from './skill-card'
import { SkillDetail } from './skill-detail'
import { useAllSkills, useSyncRegistry, type CombinedSkill } from '@/hooks/use-skills'
import { useUIStore } from '@/store/ui'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

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
  const [selectedSkill, setSelectedSkill] = useState<CombinedSkill | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [showPlatformAlert, setShowPlatformAlert] = useState(false)

  const { skills, isLoading, isError } = useAllSkills({
    category: category === 'All' ? undefined : category,
    search: search || undefined
  })

  const sync = useSyncRegistry()
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const setSettingsTab = useUIStore((s) => s.setSettingsTab)

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await sync.mutateAsync()
      toast.success(`Synced ${result} skills from registry`)
      setLastSync(new Date())
    } catch (error) {
      if (error instanceof Error && error.message === 'PLATFORM_NOT_CONFIGURED') {
        setShowPlatformAlert(true)
      } else {
        toast.error(`Sync failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    } finally {
      setSyncing(false)
    }
  }

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
        (s._sourceType === 'registry' && s.category === category)
      return matchSearch && matchCat
    })
  }, [skills, search, category])

  if (selectedSkill) {
    return (
      <SkillDetail
        skill={selectedSkill._sourceType === 'registry' ? selectedSkill : null}
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
          onClick={handleSync}
          disabled={syncing}
          title="Sync from registry"
        >
          <RefreshCw
            className={cn('size-3.5', syncing && 'animate-spin')}
          />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3 overflow-hidden">
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
                onClick={() => window.location.reload()}
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
            <div className="grid grid-cols-1 gap-2 overflow-hidden">
              {filtered.map((skill) => (
                <SkillCard
                  key={skill._sourceType === 'registry' ? skill.id : skill.name}
                  skill={skill}
                  onSelect={() => {
                    if (skill._sourceType === 'registry') {
                      setSelectedSkill(skill)
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer summary */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border text-[11px] text-muted-foreground shrink-0">
        <span>
          {filtered.length} skill{filtered.length !== 1 ? 's' : ''}
          {filtered.length !== skills.length && ` (filtered from ${skills.length})`}
        </span>
        {lastSync && (
          <span className="text-[10px]">
            Last sync: {formatDistanceToNow(lastSync, { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Platform configuration alert */}
      {showPlatformAlert && (
        <AlertDialog open onOpenChange={setShowPlatformAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Platform sync unavailable</AlertDialogTitle>
              <AlertDialogDescription>
                You need to connect to the SkillDeck Platform to sync community skills.
                Configure your platform settings to enable this feature.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                setShowPlatformAlert(false)
                setSettingsTab('platform')
                setSettingsOpen(true)
              }}>
                Open Settings
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
