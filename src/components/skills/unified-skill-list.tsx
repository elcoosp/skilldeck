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
//
// If you'd rather keep it co-located, the <style> tag below injects it once.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import { AlertCircle, RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { useUnifiedSkills } from '@/hooks/use-unified-skills'
import { commands } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import type { UnifiedSkill } from '@/types/skills'
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
  const [debouncedSearch] = useDebounce(search, 300)
  const [selected, setSelected] = useState<UnifiedSkill | null>(null)
  const [isMeasured, setIsMeasured] = useState(false)
  const isMeasuredRef = useRef(false)
  const measurementsRef = useRef<Map<Element, number>>(new Map())

  const containerRef = useRef<HTMLDivElement>(null)
  const columns = useColumnCount(containerRef)

  const { unifiedSkills, isLoading, installedCount, registryError } =
    useUnifiedSkills({ search: debouncedSearch || undefined })

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

  const parentRef = useRef<HTMLDivElement>(null)

  const rowCount = Math.ceil(unifiedSkills.length / columns)

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
  // biome-ignore lint/correctness/useExhaustiveDependencies:ok
  useEffect(() => {
    if (
      !isMeasuredRef.current &&
      rowVirtualizer.getTotalSize() > 0 &&
      unifiedSkills.length > 0
    ) {
      isMeasuredRef.current = true
      setIsMeasured(true)
    }
  }, [rowVirtualizer.getTotalSize(), unifiedSkills.length])

  // Keep selected skill in sync if data refreshes
  const resolvedSelected = selected
    ? (unifiedSkills.find((s) => s.id === selected.id) ?? selected)
    : null

  return (
    <div className="flex h-full min-h-0" ref={containerRef}>
      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Toolbar */}
        <div className="px-5 pt-5 pb-3 border-b border-border/50 shrink-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold leading-tight">
                Skill Marketplace
              </h1>
              {!isLoading && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {installedCount} installed · {unifiedSkills.length} total
                  {registryError && (
                    <span className="ml-2 text-amber-500">
                      (registry offline)
                    </span>
                  )}
                </p>
              )}
            </div>

            <button
              type="button"
              title="Sync registry"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className={cn(
                'h-7 w-7 flex items-center justify-center rounded-md',
                'text-muted-foreground hover:text-foreground hover:bg-muted',
                'transition-colors shrink-0 mt-0.5'
              )}
            >
              <RefreshCw
                className={cn(
                  'h-3.5 w-3.5',
                  syncMutation.isPending && 'animate-spin'
                )}
              />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
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
        ) : unifiedSkills.length === 0 ? (
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
                const rowItems = unifiedSkills.slice(
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
                        />
                      </motion.div>
                    ))}
                    {/* Pad incomplete last row */}
                    {Array.from({
                      length: columns - rowItems.length
                    }).map((i) => (
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
        <Search className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium">No skills match "{search}"</p>
        <p className="text-xs text-muted-foreground">
          Try a different search term or clear the filter.
        </p>
      </div>
    )
  }

  // ✨ Whimsical empty state for no skills at all
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
