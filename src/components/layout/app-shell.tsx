// src/components/layout/app-shell.tsx

import { useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Toaster } from 'sonner'
import { CommandPalette } from '@/components/overlays/command-palette'
import { LaunchNotificationBanner } from '@/components/overlays/launch-notification'
import { SettingsOverlay } from '@/components/overlays/settings-overlay'
import { useNudgeListener, usePlatformRegistration } from '@/hooks/use-platform'
import { useUIStore } from '@/store/ui'
import { CenterPanel } from './center-panel'
import { LeftPanel } from './left-panel'
import { RightPanel } from './right-panel'
import { GlobalDropZone } from '@/components/chat/global-drop-zone'

const LAYOUT_STORAGE_KEY = 'skilldeck-panel-layout'
const DEFAULT_LAYOUT = [20, 60, 20]

export function AppShell() {
  const setPanelSizesPx = useUIStore((s) => s.setPanelSizesPx)

  const [layout, setLayout] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem(LAYOUT_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length === 3) {
          console.log('[AppShell] Loaded layout from storage:', parsed)
          return parsed
        }
      }
    } catch { }
    console.log('[AppShell] Using default layout:', DEFAULT_LAYOUT)
    return DEFAULT_LAYOUT
  })

  // Observe left and right panels by their data-panel attribute
  useEffect(() => {
    const getPanels = () => {
      // The first panel (left) and the third panel (right) – assume order
      const panels = document.querySelectorAll('[data-panel]')
      return {
        left: panels[0] as HTMLDivElement,
        right: panels[2] as HTMLDivElement
      }
    }

    const updateSizes = () => {
      const { left, right } = getPanels()
      const leftWidth = left?.clientWidth ?? 0
      const rightWidth = right?.clientWidth ?? 0
      console.log('[AppShell] Observed panel widths:', { leftWidth, rightWidth })
      setPanelSizesPx({ left: leftWidth, right: rightWidth })
    }

    // Initial update (may run before panels are mounted, but ResizeObserver will catch later)
    updateSizes()

    // Set up ResizeObservers on the panels
    const observer = new ResizeObserver(() => updateSizes())
    const { left, right } = getPanels()
    if (left) observer.observe(left)
    if (right) observer.observe(right)

    // Also observe window resize as a fallback
    window.addEventListener('resize', updateSizes)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateSizes)
    }
  }, [setPanelSizesPx])

  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const setGlobalSearchOpen = useUIStore((s) => s.setGlobalSearchOpen)
  const settingsOpen = useUIStore((s) => s.settingsOpen)

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
          onLayoutChange={(sizes) => {
            // Store the layout for persistence
            setLayout(sizes)
            localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(sizes))
          }}
        >
          <Panel minSize="15%" maxSize="30%" className="border-r border-border">
            <LeftPanel />
          </Panel>

          <Separator className="w-px bg-border hover:bg-primary/30 transition-colors cursor-col-resize" />

          <Panel minSize="35%">
            <CenterPanel />
          </Panel>

          <Separator className="w-px bg-border hover:bg-primary/30 transition-colors cursor-col-resize" />

          <Panel minSize="18%" maxSize="35%" className="border-l border-border">
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
