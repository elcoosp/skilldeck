// src/components/skills/unified-skill-list.tsx

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import { AlertCircle, RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useUnifiedSkills } from '@/hooks/use-unified-skills'
import { commands } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'
import type { UnifiedSkill } from '@/types/skills'
import { PlatformStatusBanner } from './platform-status-banner'
import { SkillDetailPanel } from './skill-detail-panel'
import { UnifiedSkillCard } from './unified-skill-card'
import { toast } from 'sonner'

// Responsive column count based on container width
const BREAKPOINTS = {
  single: 400,
  double: 600
}

function useColumnCount(ref: React.RefObject<HTMLElement | null>) {
  const [columns, setColumns] = useState(3)

  useEffect(() => {
    if (!ref.current) return

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (!width) return

      if (width < BREAKPOINTS.single) {
        setColumns(1)
      } else if (width < BREAKPOINTS.double) {
        setColumns(2)
      } else {
        setColumns(3)
      }
    })

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])

  return columns
}

const ROW_HEIGHT_ESTIMATE = 164 // px

export function UnifiedSkillList() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [debouncedSearch] = useDebounce(search, 300)
  const [selected, setSelected] = useState<UnifiedSkill | null>(null)
  const [isMeasured, setIsMeasured] = useState(false)
  const isMeasuredRef = useRef(false)
  const measurementsRef = useRef<Map<Element, number>>(new Map())

  const containerRef = useRef<HTMLDivElement>(null)
  const columns = useColumnCount(containerRef)

  const prevColumnsRef = useRef(columns)
  useEffect(() => {
    if (prevColumnsRef.current !== columns) {
      measurementsRef.current.clear()
      prevColumnsRef.current = columns
    }
  }, [columns])

  const { unifiedSkills, isLoading, installedCount, registryError } =
    useUnifiedSkills({ search: debouncedSearch || undefined })

  const localWithIssues = unifiedSkills.filter(
    (s) => s.status === 'local_only' || s.status === 'installed'
  ).filter(
    (s) => (s.localData?.lint_warnings?.length ?? 0) > 0
  ).length

  const categories = useMemo(() => {
    const cats = new Set<string>()
    unifiedSkills.forEach((skill) => {
      if (
        skill.registryData?.category &&
        skill.registryData.category.trim() !== ''
      ) {
        cats.add(skill.registryData.category)
      }
    })
    return ['all', ...Array.from(cats).sort()]
  }, [unifiedSkills])

  const filteredSkills = useMemo(() => {
    if (category === 'all') return unifiedSkills
    return unifiedSkills.filter((s) => s.registryData?.category === category)
  }, [unifiedSkills, category])

  const qc = useQueryClient()
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await commands.syncRegistrySkills()
      if (res.status === 'error') {
        if (res.error.includes('Platform not configured')) {
          throw new Error('PLATFORM_NOT_CONFIGURED')
        }
        throw new Error(res.error)
      }
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registry_skills'] })
      qc.invalidateQueries({ queryKey: ['local_skills'] })
    }
  })

  const installMutation = useMutation({
    mutationFn: async (skill: UnifiedSkill) => {
      if (!skill.registryData) throw new Error('No registry data')
      const res = await commands.installSkill(
        skill.registryData.name,
        skill.registryData.content,
        'personal',
        null
      )
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['local_skills'] })
      toast.success('Skill installed')
    },
    onError: (err) => toast.error(`Install failed: ${err}`)
  })

  const updateMutation = useMutation({
    mutationFn: async (skill: UnifiedSkill) => {
      if (!skill.registryData) throw new Error('No registry data')
      const res = await commands.installSkill(
        skill.registryData.name,
        skill.registryData.content,
        'personal',
        true // overwrite
      )
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['local_skills'] })
      toast.success('Skill updated')
    },
    onError: (err) => toast.error(`Update failed: ${err}`)
  })

  const platformFeaturesEnabled = useUIStore((s) => s.platformFeaturesEnabled)
  const setSettingsTab = useUIStore((s) => s.setSettingsTab)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)

  const parentRef = useRef<HTMLDivElement>(null)

  const rowCount = Math.ceil(filteredSkills.length / columns)

  const measureElement = useCallback((el: Element | null) => {
    if (!el) return ROW_HEIGHT_ESTIMATE
    if (measurementsRef.current.has(el)) {
      return measurementsRef.current.get(el)!
    }
    const height = (el as HTMLElement).getBoundingClientRect().height
    measurementsRef.current.set(el, height)
    return height
  }, [])

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    measureElement,
    overscan: 2
  })

  useEffect(() => {
    if (
      !isMeasuredRef.current &&
      rowVirtualizer.getTotalSize() > 0 &&
      filteredSkills.length > 0
    ) {
      isMeasuredRef.current = true
      setIsMeasured(true)
    }
  }, [rowVirtualizer.getTotalSize(), filteredSkills.length])

  const resolvedSelected = selected
    ? (filteredSkills.find((s) => s.id === selected.id) ?? selected)
    : null

  const handleEnablePlatform = () => {
    setSettingsTab('platform')
    setSettingsOpen(true)
  }

  const handleInstall = (skill: UnifiedSkill) => {
    installMutation.mutate(skill)
  }

  const handleUpdate = (skill: UnifiedSkill) => {
    updateMutation.mutate(skill)
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex flex-col flex-1 min-w-0 h-full" ref={containerRef}>
        <div className="px-3 pt-3">
          <PlatformStatusBanner
            variant={
              !platformFeaturesEnabled
                ? 'disabled'
                : registryError
                  ? 'error'
                  : null
            }
            onEnable={handleEnablePlatform}
            onRetry={() => syncMutation.mutate()}
          />
        </div>

        <div className="flex items-center justify-between px-3 pt-0 pb-2 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Skill Registry
          </span>
          <div className="flex items-center gap-2">
            {localWithIssues > 0 && (
              <span
                className="text-xs text-amber-500 font-medium"
                title={`${localWithIssues} local skill(s) have lint issues`}
              >
                {localWithIssues} ⚠
              </span>
            )}
            <button
              type="button"
              onClick={() => syncMutation.mutate()}
              disabled={!platformFeaturesEnabled || syncMutation.isPending}
              title={
                !platformFeaturesEnabled ? 'Enable platform to sync' : 'Refresh'
              }
              className={cn(
                'p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40',
                syncMutation.isPending && 'animate-spin'
              )}
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="px-3 pb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search skills…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                'w-full h-8 pl-8 pr-3 rounded-md border border-input bg-background',
                'text-sm placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-1 focus:ring-ring'
              )}
            />
          </div>

          {categories.length > 1 && (
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat} className="text-xs">
                    {cat === 'all' ? 'All categories' : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground">
                Loading marketplace…
              </p>
            </div>
          </div>
        ) : !isMeasured ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground">
                Preparing marketplace…
              </p>
            </div>
          </div>
        ) : filteredSkills.length === 0 ? (
          <EmptyState search={search} hasRegistryError={!!registryError} />
        ) : (
          <div
            ref={parentRef}
            className="flex-1 overflow-auto px-4 py-4 overflow-x-hidden"
            style={{ scrollbarGutter: 'stable' }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative'
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const startIdx = virtualRow.index * columns
                const rowItems = filteredSkills.slice(
                  startIdx,
                  startIdx + columns
                )

                return (
                  <div
                    key={virtualRow.index}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      display: 'grid',
                      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                      gap: '0.75rem',
                      paddingBottom: '0.75rem',
                      contain: 'layout style'
                    }}
                  >
                    {rowItems.map((skill, colIdx) => (
                      <motion.div
                        layout="position"
                        key={skill.id}
                        style={{
                          contain: 'content'
                        }}
                        initial={{ opacity: 0, y: 12, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{
                          type: 'spring',
                          stiffness: 100,
                          damping: 12,
                          delay: colIdx * 0.03
                        }}
                      >
                        <UnifiedSkillCard
                          skill={skill}
                          isSelected={resolvedSelected?.id === skill.id}
                          onClick={(s) =>
                            setSelected((prev) =>
                              prev?.id === s.id ? null : s
                            )
                          }
                          onInstall={platformFeaturesEnabled ? handleInstall : undefined}
                          onUpdate={platformFeaturesEnabled ? handleUpdate : undefined}
                        />
                      </motion.div>
                    ))}
                    {Array.from({
                      length: columns - rowItems.length
                    }).map((_, i) => (
                      <div key={`pad-${i}`} />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {resolvedSelected && (
        <SkillDetailPanel
          skill={resolvedSelected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function EmptyState({
  search,
  hasRegistryError
}: {
  search: string
  hasRegistryError: boolean
}) {
  if (hasRegistryError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
        <img
          src="/illustrations/empty-skills.jpeg"
          alt="No skills"
          className="w-48 h-48 mb-2 opacity-90 rounded-3xl"
        />
        <AlertCircle className="h-8 w-8 text-amber-500" />
        <p className="text-sm font-medium">Registry unavailable</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Could not reach the skill registry. Local skills are still shown.
          Check your network or platform configuration.
        </p>
      </div>
    )
  }

  if (search) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
        <img
          src="/illustrations/empty-skills.jpeg"
          alt="No skills"
          className="w-48 h-48 mb-2 opacity-90 rounded-3xl"
        />
        <div className="flex items-center justify-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">No skills match "{search}"</p>
        </div>
        <p className="text-xs text-muted-foreground max-w-xs">
          Try a different search term or clear the filter.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
      <img
        src="/illustrations/empty-skills.jpeg"
        alt="No skills"
        className="w-48 h-48 mb-2 opacity-90 rounded-3xl"
      />
      <h3 className="text-base font-semibold text-foreground mb-1">
        Your toolkit is waiting to be built.
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Sync the registry or create your own skill—every deck needs its cards.
      </p>
    </div>
  )
}
