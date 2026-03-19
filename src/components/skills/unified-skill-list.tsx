// src/components/skills/unified-skill-list.tsx
// Virtualized marketplace grid — merges local + registry skills via
// useUnifiedSkills, renders rows with responsive column count.
//
// ── Card entrance animation ───────────────────────────────────────────────────
// Add the following to your global CSS (e.g. globals.css / index.css):
//
//   @keyframes skill-card-in {
//     from { opacity: 0; transform: translateY(8px) scale(0.97); }
//     to   { opacity: 1; transform: translateY(0)   scale(1);    }
//   }
//   .skill-card-enter {
//     animation: skill-card-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
//   }
// ─────────────────────────────────────────────────────────────────────────────

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

// Responsive column count based on container width
const BREAKPOINTS = {
  single: 400,
  double: 600
}

function useColumnCount(ref: React.RefObject<HTMLElement | null>) {
  const [columns, setColumns] = useState(3) // default to 3, will adjust on mount

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

  const { unifiedSkills, isLoading, installedCount, registryError } =
    useUnifiedSkills({ search: debouncedSearch || undefined })

  // Compute local skills with issues for summary badge
  const localWithIssues = unifiedSkills.filter(
    (s) => s.status === 'local_only' || s.status === 'installed'
  ).filter(
    (s) => (s.localData?.lint_warnings?.length ?? 0) > 0
  ).length

  // Compute unique categories from registry skills that have a category
  const categories = useMemo(() => {
    const cats = new Set<string>()
    unifiedSkills.forEach((skill) => {
      // Only include registry skills that have a non-null category
      if (
        skill.registryData?.category &&
        skill.registryData.category.trim() !== ''
      ) {
        cats.add(skill.registryData.category)
      }
    })
    // Convert to sorted array, with "all" always first
    return ['all', ...Array.from(cats).sort()]
  }, [unifiedSkills])

  // Filter by category (if not "all")
  const filteredSkills = useMemo(() => {
    if (category === 'all') return unifiedSkills
    return unifiedSkills.filter((s) => s.registryData?.category === category)
  }, [unifiedSkills, category])

  const qc = useQueryClient()
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await commands.syncRegistrySkills()
      if (res.status === 'error') throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registry_skills'] })
      qc.invalidateQueries({ queryKey: ['local_skills'] })
    }
  })

  const platformFeaturesEnabled = useUIStore((s) => s.platformFeaturesEnabled)
  const setSettingsTab = useUIStore((s) => s.setSettingsTab)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)

  const parentRef = useRef<HTMLDivElement>(null)

  const rowCount = Math.ceil(filteredSkills.length / columns)

  // measureElement stabilises row heights so the virtualizer doesn't
  // re-measure on every scroll tick, which was causing the flash.
  const measureElement = useCallback((el: Element | null) => {
    if (!el) return ROW_HEIGHT_ESTIMATE

    // Return cached measurement if available
    if (measurementsRef.current.has(el)) {
      return measurementsRef.current.get(el)!
    }

    // Measure and cache
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

  // Only set isMeasured once to prevent constant rerenders
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

  // Keep selected skill in sync if data refreshes
  const resolvedSelected = selected
    ? (filteredSkills.find((s) => s.id === selected.id) ?? selected)
    : null

  const handleEnablePlatform = () => {
    setSettingsTab('platform')
    setSettingsOpen(true)
  }

  return (
    <div className="flex h-full min-h-0" ref={containerRef}>
      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Platform status banner - flush with sides, only top padding */}
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

        {/* Header row - matches MCP tab exactly */}
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

        {/* Search and category filter row - matching side padding */}
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

          {/* Only show category filter if there is at least one category besides "all" */}
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

        {/* Grid area */}
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
            {/* Virtual scroll container */}
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
                          onInstall={() => setSelected(skill)}
                          onUpdate={() => setSelected(skill)}
                        />
                      </motion.div>
                    ))}
                    {/* Pad incomplete last row */}
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

      {/* ── Detail panel ──────────────────────────────────────────────────── */}
      {resolvedSelected && (
        <SkillDetailPanel
          skill={resolvedSelected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

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

  // Default empty state (no skills at all)
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
