import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import { AlertCircle, RefreshCw, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/components/ui/toast'
import { useDebounce } from 'use-debounce'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUnifiedSkills } from '@/hooks/use-unified-skills'
import { commands } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import { useUIPersistentStore } from '@/store/ui-state'
import type { UnifiedSkill } from '@/types/skills'
import { PlatformStatusBanner } from './platform-status-banner'
import { SkillDetailPanel } from './skill-detail-panel'
import { UnifiedSkillCard } from './unified-skill-card'
import { RightPanelHeader } from '@/components/layout/right-panel-header'
import { EmptyState } from '@/components/ui/empty-state'
import { FolderOpen, Globe } from 'lucide-react'
import { Input } from '@/components/ui/input'

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
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'local' | 'registry'>('local')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [debouncedSearch] = useDebounce(search, 300)
  const [selected, setSelected] = useState<UnifiedSkill | null>(null)
  const [isMeasured, setIsMeasured] = useState(false)
  const isMeasuredRef = useRef(false)
  const measurementsRef = useRef<Map<Element, number>>(new Map())
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [isBatchUpdating, setIsBatchUpdating] = useState(false)
  const [registrationNeeded, setRegistrationNeeded] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const columns = useColumnCount(containerRef)

  const prevColumnsRef = useRef(columns)
  useEffect(() => {
    if (prevColumnsRef.current !== columns) {
      measurementsRef.current.clear()
      prevColumnsRef.current = columns
    }
  }, [columns])

  const { unifiedSkills, isLoading, registryError } = useUnifiedSkills({
    search: debouncedSearch || undefined
  })

  // Filter skills based on active tab
  const filteredSkillsByTab = useMemo(() => {
    if (activeTab === 'local') {
      return unifiedSkills.filter(
        (s) =>
          s.status === 'local_only' ||
          s.status === 'installed' ||
          s.status === 'update_available'
      )
    } else {
      return unifiedSkills.filter((s) => s.status === 'available')
    }
  }, [unifiedSkills, activeTab])

  // Apply category filter (only meaningful for registry skills)
  const filteredSkills = useMemo(() => {
    if (category === 'all') return filteredSkillsByTab
    return filteredSkillsByTab.filter(
      (s) => s.registryData?.category === category
    )
  }, [filteredSkillsByTab, category])

  // Update lastSynced whenever registry data appears or after a successful sync
  useEffect(() => {
    if (!registryError && unifiedSkills.some((s) => s.registryData)) {
      setLastSynced(new Date())
      setRegistrationNeeded(false)
    }
  }, [unifiedSkills, registryError])

  const localWithIssues = unifiedSkills
    .filter((s) => s.status === 'local_only' || s.status === 'installed')
    .filter((s) => (s.localData?.lint_warnings?.length ?? 0) > 0).length

  const updateAvailableCount = useMemo(() => {
    return unifiedSkills.filter((s) => s.status === 'update_available').length
  }, [unifiedSkills])

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

  const batchUpdateMutation = useMutation({
    mutationFn: async () => {
      const updateSkills = unifiedSkills.filter(
        (s) => s.status === 'update_available'
      )
      if (updateSkills.length === 0) return { successCount: 0, failCount: 0 }

      setIsBatchUpdating(true)
      let successCount = 0
      let failCount = 0

      for (const skill of updateSkills) {
        if (!skill.registryData) continue
        try {
          await commands.installSkill(
            skill.registryData.name,
            skill.registryData.content,
            'personal',
            true
          )
          successCount++
        } catch (err) {
          console.error(`Failed to update ${skill.name}:`, err)
          failCount++
        }
      }

      return { successCount, failCount }
    },
    onSuccess: (result) => {
      if (result) {
        const { successCount, failCount } = result
        if (failCount === 0) {
          toast.success(`Updated ${successCount} skill(s)`)
        } else {
          toast.warning(`Updated ${successCount}, ${failCount} failed`)
        }
      }
      qc.invalidateQueries({ queryKey: ['local_skills'] })
      qc.invalidateQueries({ queryKey: ['registry_skills'] })
      setIsBatchUpdating(false)
    },
    onError: (err) => {
      toast.error(`Batch update failed: ${err}`)
      setIsBatchUpdating(false)
    }
  })

  const platformFeaturesEnabled = useUIPersistentStore(
    (s) => s.platformFeaturesEnabled
  )

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

  // Capture stable values for dependencies
  const totalSize = rowVirtualizer.getTotalSize()

  useEffect(() => {
    if (!isMeasuredRef.current && totalSize > 0 && filteredSkills.length > 0) {
      isMeasuredRef.current = true
      setIsMeasured(true)
    }
  }, [totalSize, filteredSkills.length])

  const resolvedSelected = selected
    ? (filteredSkills.find((s) => s.id === selected.id) ?? selected)
    : null

  const handleEnablePlatform = () => {
    router.navigate({ to: '/settings/platform' })
  }

  const handleInstall = (skill: UnifiedSkill) => {
    installMutation.mutate(skill)
  }

  const handleUpdate = (skill: UnifiedSkill) => {
    if (isBatchUpdating) {
      toast.info('Batch update in progress, please wait')
      return
    }
    updateMutation.mutate(skill)
  }

  const handleSync = useCallback(() => {
    syncMutation.mutate(undefined, {
      onSuccess: () => {
        setLastSynced(new Date())
        setRegistrationNeeded(false)
      },
      onError: (err) => {
        if (err.message === 'PLATFORM_NOT_CONFIGURED') {
          setRegistrationNeeded(true)
          toast.error('Platform not registered', {
            action: {
              label: 'Register',
              onClick: () => {
                router.navigate({ to: '/settings/platform' })
              }
            }
          })
        } else {
          toast.error(`Sync failed: ${err.message}`)
        }
      }
    })
  }, [syncMutation, router])

  const toggleSearch = useCallback(() => {
    setShowSearch((prev) => !prev)
    if (!showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [showSearch])

  const clearSearch = useCallback(() => {
    setSearch('')
    searchInputRef.current?.focus()
  }, [])

  return (
    <div className="flex h-full min-h-0">
      <div className="flex flex-col flex-1 min-w-0 h-full" ref={containerRef}>
        <RightPanelHeader
          title="Skills"
          actions={
            <div className="flex items-center gap-1">
              {localWithIssues > 0 && (
                <span
                  className="text-xs text-amber-500 font-medium"
                  title={`${localWithIssues} local skill(s) have lint issues`}
                >
                  {localWithIssues} ⚠
                </span>
              )}
              {activeTab === 'local' && updateAvailableCount > 0 && (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => batchUpdateMutation.mutate()}
                  disabled={isBatchUpdating || batchUpdateMutation.isPending}
                  className="h-6 px-2 text-xs"
                >
                  {isBatchUpdating ? (
                    <>
                      <RefreshCw className="size-3 mr-1 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>Update all ({updateAvailableCount})</>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={toggleSearch}
                title="Search skills"
              >
                <Search className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => handleSync()}
                disabled={!platformFeaturesEnabled || syncMutation.isPending}
                title={!platformFeaturesEnabled ? 'Enable platform to sync' : 'Refresh'}
              >
                <RefreshCw className={cn('size-4', syncMutation.isPending && 'animate-spin')} />
              </Button>
            </div>
          }
        />

        {/* Expandable search bar */}
        {showSearch && (
          <div className="px-3 py-2 border-b border-border/50 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search skills…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-8 h-8 text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList className="mx-3 mt-2 w-fit">
            <TabsTrigger value="local">Local</TabsTrigger>
            <TabsTrigger value="registry">Registry</TabsTrigger>
          </TabsList>

          <TabsContent
            value="local"
            className="flex-1 min-h-0 overflow-hidden flex flex-col"
          >
            <div className="px-3 py-2 flex gap-2">
              {activeTab === 'registry' && categories.length > 1 && (
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

            {renderContent()}
          </TabsContent>

          <TabsContent
            value="registry"
            className="flex-1 min-h-0 overflow-hidden flex flex-col"
          >
            <div className="mb-2">
              {!platformFeaturesEnabled && (
                <PlatformStatusBanner
                  variant="disabled"
                  onEnable={handleEnablePlatform}
                />
              )}
              {lastSynced && platformFeaturesEnabled && (
                <div className="text-right text-[10px] text-muted-foreground px-3 pt-1">
                  Last synced: {lastSynced.toLocaleTimeString()}
                </div>
              )}
            </div>
            <div className="px-3 py-2 flex gap-2">
              {activeTab === 'registry' && categories.length > 1 && (
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

            {renderContent()}
          </TabsContent>
        </Tabs>
      </div>

      {resolvedSelected && (
        <SkillDetailPanel
          skill={resolvedSelected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )

  function renderContent() {
    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center p-3">
          <div className="text-center space-y-2">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-muted-foreground">
              Loading marketplace…
            </p>
          </div>
        </div>
      )
    }

    if (!isMeasured) {
      return (
        <div className="flex-1 flex items-center justify-center p-3">
          <div className="text-center space-y-2">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-muted-foreground">
              Preparing marketplace…
            </p>
          </div>
        </div>
      )
    }

    if (filteredSkills.length === 0) {
      return (
        <SkillsEmptyState
          search={search}
          hasRegistryError={!!registryError}
          tab={activeTab}
          platformEnabled={platformFeaturesEnabled}
          registrationNeeded={registrationNeeded}
          onEnablePlatform={handleEnablePlatform}
          onSync={handleSync}
          isSyncing={syncMutation.isPending}
        />
      )
    }

    return (
      <div
        ref={parentRef}
        className="h-full overflow-auto px-3 py-3 overflow-x-hidden thin-scrollbar"
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
            const rowItems = filteredSkills.slice(startIdx, startIdx + columns)

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
                        setSelected((prev) => (prev?.id === s.id ? null : s))
                      }
                      onInstall={
                        platformFeaturesEnabled ? handleInstall : undefined
                      }
                      onUpdate={
                        platformFeaturesEnabled ? handleUpdate : undefined
                      }
                    />
                  </motion.div>
                ))}
                {Array.from({
                  length: columns - rowItems.length
                }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder
                  <div key={`pad-${i}`} />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
}

function SkillsEmptyState({
  search,
  hasRegistryError,
  tab,
  platformEnabled,
  registrationNeeded,
  onEnablePlatform,
  onSync,
  isSyncing
}: {
  search: string
  hasRegistryError: boolean
  tab: 'local' | 'registry'
  platformEnabled: boolean
  registrationNeeded?: boolean
  onEnablePlatform?: () => void
  onSync?: () => void
  isSyncing?: boolean
}) {
  if (hasRegistryError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Registry unavailable"
        description="Could not reach the skill registry. Local skills are still shown."
        action={
          onSync
            ? {
              label: 'Retry',
              onClick: onSync
            }
            : undefined
        }
      />
    )
  }

  if (search) {
    return (
      <EmptyState
        icon={Search}
        title={`No skills match "${search}"`}
        description="Try a different search term or clear the filter"
      />
    )
  }

  if (tab === 'local') {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No local skills"
        description="Install skills from the registry or create your own"
      />
    )
  }

  // Registry tab empty state
  if (!platformEnabled) {
    return (
      <EmptyState
        icon={Globe}
        title="Connect to Platform"
        description="Enable platform features to discover and install community skills"
        action={
          onEnablePlatform
            ? {
              label: 'Connect Platform',
              onClick: onEnablePlatform
            }
            : undefined
        }
      />
    )
  }

  if (registrationNeeded) {
    return (
      <EmptyState
        icon={Globe}
        title="Platform not registered"
        description="Register with the platform to sync skills"
        action={
          onEnablePlatform
            ? {
              label: 'Register Now',
              onClick: onEnablePlatform
            }
            : undefined
        }
      />
    )
  }

  return (
    <EmptyState
      icon={Globe}
      title="No registry skills"
      description="Sync with the platform to discover new skills"
      action={
        onSync
          ? {
            label: isSyncing ? 'Syncing…' : 'Sync now',
            onClick: onSync
          }
          : undefined
      }
    />
  )
}
