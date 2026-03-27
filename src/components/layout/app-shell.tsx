// src/components/layout/app-shell.tsx
import { useEffect, useRef, useState, useCallback } from 'react'
import { Group, Panel, Separator, type Layout } from 'react-resizable-panels'
import { Toaster } from 'sonner'
import { useHotkeys } from 'react-hotkeys-hook'
import { CommandPalette } from '@/components/overlays/command-palette'
import { LaunchNotificationBanner } from '@/components/overlays/launch-notification'
import { SettingsOverlay } from '@/components/overlays/settings-overlay'
import { useNudgeListener, usePlatformRegistration } from '@/hooks/use-platform'
import { CenterPanel } from './center-panel'
import { LeftPanel } from './left-panel'
import { RightPanel } from './right-panel'
import { GlobalDropZone } from '@/components/chat/global-drop-zone'
import { useUIOverlaysStore } from '@/store/ui-overlays'
import { useUILayoutStore } from '@/store/ui-layout'

const LAYOUT_STORAGE_KEY = 'skilldeck-panel-layout'

// Panel IDs – stable strings used as keys in the Layout map
const PANEL_LEFT = 'left'
const PANEL_CENTER = 'center'
const PANEL_RIGHT = 'right'

const DEFAULT_LAYOUT: Layout = {
  [PANEL_LEFT]: 20,
  [PANEL_CENTER]: 60,
  [PANEL_RIGHT]: 20,
}

export function AppShell() {
  const setPanelSizesPx = useUILayoutStore((s) => s.setPanelSizesPx)

  const [layout, setLayout] = useState<Layout>(() => {
    try {
      const stored = localStorage.getItem(LAYOUT_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Accept both old number[] format and new Layout map
        if (Array.isArray(parsed) && parsed.length === 3) {
          return {
            [PANEL_LEFT]: parsed[0],
            [PANEL_CENTER]: parsed[1],
            [PANEL_RIGHT]: parsed[2],
          }
        }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Layout
        }
      }
    } catch { }
    return DEFAULT_LAYOUT
  })

  // Sync pixel sizes on mount (one-time read, no ResizeObserver)
  useEffect(() => {
    const panels = document.querySelectorAll('[data-panel]')
    const left = panels[0] as HTMLDivElement
    const right = panels[2] as HTMLDivElement
    setPanelSizesPx({
      left: left?.clientWidth ?? 0,
      right: right?.clientWidth ?? 0,
    })
  }, [setPanelSizesPx])

  // Debounce ref for localStorage persistence
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ⚠️ Use onLayoutChanged (fires once on pointer release) instead of
  // onLayoutChange (fires on every pointer move). This eliminates lag.
  const handleLayoutChanged = useCallback((newLayout: Layout) => {
    setLayout(newLayout)

    // Derive pixel sizes from percentages – no DOM read needed
    const totalWidth = window.innerWidth
    setPanelSizesPx({
      left: Math.round(((newLayout[PANEL_LEFT] ?? 20) / 100) * totalWidth),
      right: Math.round(((newLayout[PANEL_RIGHT] ?? 20) / 100) * totalWidth),
    })

    // Debounce the write just in case
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(newLayout))
    }, 300)
  }, [setPanelSizesPx])

  const setCommandPaletteOpen = useUIOverlaysStore((s) => s.setCommandPaletteOpen)
  const setSettingsOpen = useUIOverlaysStore((s) => s.setSettingsOpen)
  const setGlobalSearchOpen = useUIOverlaysStore((s) => s.setGlobalSearchOpen)
  const settingsOpen = useUIOverlaysStore((s) => s.settingsOpen)

  usePlatformRegistration()
  useNudgeListener()

  useHotkeys('meta+k, ctrl+k', (e) => {
    e.preventDefault()
    setCommandPaletteOpen(true)
  })

  useHotkeys('meta+,, ctrl+,', (e) => {
    e.preventDefault()
    setSettingsOpen(true)
  })

  useHotkeys('meta+shift+f, ctrl+shift+f', (e) => {
    e.preventDefault()
    setGlobalSearchOpen(true)
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'F' && e.shiftKey) {
        e.preventDefault()
        setGlobalSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setCommandPaletteOpen, setSettingsOpen, setGlobalSearchOpen])

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
            minSize={"15%"}
            maxSize={"30%"}
            className="border-r border-border"
          >
            <LeftPanel />
          </Panel>

          <Separator className="w-px bg-border hover:bg-primary/30 transition-colors cursor-col-resize" />

          <Panel id={PANEL_CENTER} minSize={35}>
            <CenterPanel />
          </Panel>

          <Separator className="w-px bg-border hover:bg-primary/30 transition-colors cursor-col-resize" />

          <Panel
            id={PANEL_RIGHT}
            minSize={"18%"}
            maxSize={"35%"}
            className="border-l border-border"
          >
            <RightPanel />
          </Panel>
        </Group>
      </div>

      <CommandPalette />
      {settingsOpen && <SettingsOverlay />}
      <GlobalDropZone />
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}
