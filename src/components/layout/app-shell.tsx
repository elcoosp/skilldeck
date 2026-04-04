// src/components/layout/app-shell.tsx
import { useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Group, type Layout, Panel, Separator } from 'react-resizable-panels'
import { Toaster } from 'sonner'
import { GlobalDropZone } from '@/components/chat/global-drop-zone'
import { CommandPalette } from '@/components/overlays/command-palette'
import { LaunchNotificationBanner } from '@/components/overlays/launch-notification'
import { GlobalSearchModal } from '@/components/search/global-search-modal'
import { useNudgeListener, usePlatformRegistration } from '@/hooks/use-platform'
import { useUILayoutStore } from '@/store/ui-layout'
import { useUIOverlaysStore } from '@/store/ui-overlays'
import { CenterPanel } from './center-panel'
import { LeftPanel } from './left-panel'
import { RightPanel } from './right-panel'

const LAYOUT_STORAGE_KEY = 'skilldeck-panel-layout'

// Panel IDs – stable strings used as keys in the Layout map
const PANEL_LEFT = 'left'
const PANEL_CENTER = 'center'
const PANEL_RIGHT = 'right'

const DEFAULT_LAYOUT: Layout = {
  [PANEL_LEFT]: 20,
  [PANEL_CENTER]: 60,
  [PANEL_RIGHT]: 20
}

export function AppShell() {
  const router = useRouter()
  const setPanelSizesPx = useUILayoutStore((s) => s.setPanelSizesPx)

  const [layout, setLayout] = useState<Layout>(() => {
    try {
      const stored = localStorage.getItem(LAYOUT_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length === 3) {
          return {
            [PANEL_LEFT]: parsed[0],
            [PANEL_CENTER]: parsed[1],
            [PANEL_RIGHT]: parsed[2]
          }
        }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Layout
        }
      }
    } catch {}
    return DEFAULT_LAYOUT
  })

  // Sync pixel sizes on mount (one-time read, no ResizeObserver)
  useEffect(() => {
    const panels = document.querySelectorAll('[data-panel]')
    const left = panels[0] as HTMLDivElement
    const center = panels[1] as HTMLDivElement
    const right = panels[2] as HTMLDivElement
    setPanelSizesPx({
      left: left?.clientWidth ?? 0,
      center: center?.clientWidth ?? 0,
      right: right?.clientWidth ?? 0
    })
  }, [setPanelSizesPx])

  // Debounce ref for localStorage persistence
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ⚠️ Use onLayoutChanged (fires once on pointer release) instead of
  // onLayoutChange (fires on every pointer move). This eliminates lag.
  const handleLayoutChanged = useCallback(
    (newLayout: Layout) => {
      setLayout(newLayout)

      // Derive pixel sizes from percentages – pure arithmetic, zero DOM reads
      const totalWidth = window.innerWidth
      const leftPx = Math.round(
        ((newLayout[PANEL_LEFT] ?? 20) / 100) * totalWidth
      )
      const rightPx = Math.round(
        ((newLayout[PANEL_RIGHT] ?? 20) / 100) * totalWidth
      )

      // Center width = total minus left/right panels minus 2px for the two separators
      const centerPx = Math.max(35, totalWidth - leftPx - rightPx - 2)

      setPanelSizesPx({
        left: leftPx,
        center: centerPx,
        right: rightPx
      })

      // Debounce the write just in case
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(newLayout))
      }, 300)
    },
    [setPanelSizesPx]
  )

  const setCommandPaletteOpen = useUIOverlaysStore(
    (s) => s.setCommandPaletteOpen
  )
  const setGlobalSearchOpen = useUIOverlaysStore((s) => s.setGlobalSearchOpen)

  usePlatformRegistration()
  useNudgeListener()

  // Command palette: Cmd+K / Ctrl+K
  useHotkeys('meta+k, ctrl+k', () => {
    setCommandPaletteOpen(true)
  })

  // Settings: Cmd+, / Ctrl+, (comma)
  useHotkeys(['meta+,', 'ctrl+,'], () => {
    router.navigate({ to: '/settings/api-keys' })
  })

  // Global search: Cmd+Shift+F / Ctrl+Shift+F
  useHotkeys('meta+shift+f, ctrl+shift+f', () => {
    setGlobalSearchOpen(true)
  })

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col">
      <LaunchNotificationBanner />

      <div className="flex-1 overflow-hidden">
        <Group
          orientation="horizontal"
          defaultLayout={layout}
          onLayoutChanged={handleLayoutChanged}
        >
          <Panel
            id={PANEL_LEFT}
            minSize={'15%'}
            maxSize={'30%'}
            className="border-r border-border"
            data-panel
          >
            <LeftPanel />
          </Panel>

          <Separator className="w-px bg-border hover:bg-primary/30 transition-colors cursor-col-resize" />

          <Panel
            id={PANEL_CENTER}
            minSize={35}
            className="overflow-hidden"
            data-panel
          >
            <CenterPanel />
          </Panel>

          <Separator className="w-px bg-border hover:bg-primary/30 transition-colors cursor-col-resize" />

          <Panel
            id={PANEL_RIGHT}
            minSize={'18%'}
            maxSize={'35%'}
            className="border-l border-border"
            data-panel
          >
            <RightPanel />
          </Panel>
        </Group>
      </div>

      <CommandPalette />
      <GlobalSearchModal />
      <GlobalDropZone />
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}
