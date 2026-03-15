/**
 * Main application shell — three-panel resizable layout.
 *
 * Implements the ASR-STR-002 IPC-only architecture: React owns zero business
 * logic; every data operation goes through invoke() or event listeners.
 */

import { Group, Panel, Separator } from 'react-resizable-panels'
import { Toaster } from 'sonner'
import { useHotkeys } from 'react-hotkeys-hook'
import { useEffect } from 'react'
import { LeftPanel } from './left-panel'
import { CenterPanel } from './center-panel'
import { RightPanel } from './right-panel'
import { CommandPalette } from '@/components/overlays/command-palette'
import { SettingsOverlay } from '@/components/overlays/settings-overlay'
import { useUIStore } from '@/store/ui'

export function AppShell() {
  const panelSizes = useUIStore((s) => s.panelSizes)
  const setPanelSizes = useUIStore((s) => s.setPanelSizes)
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const settingsOpen = useUIStore((s) => s.settingsOpen)

  // Global keyboard shortcuts (declarative hooks)
  useHotkeys('meta+k, ctrl+k', (e) => {
    e.preventDefault()
    setCommandPaletteOpen(true)
  })

  useHotkeys('meta+,, ctrl+,', (e) => {
    e.preventDefault()
    setSettingsOpen(true)
  })

  // Native fallback – guarantees shortcuts work even if the hook fails
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
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setCommandPaletteOpen, setSettingsOpen])

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <Group
        orientation="horizontal"
        onLayoutChange={(sizes) =>
          setPanelSizes({ left: sizes[0], right: sizes[2] })
        }
      >
        {/* Left — conversation list */}
        <Panel
          defaultSize={`${panelSizes.left}px`}
          minSize="15%"
          maxSize="30%"
          className="border-r border-border"
        >
          <LeftPanel />
        </Panel>

        <Separator className="w-px bg-border hover:bg-primary/30 transition-colors cursor-col-resize" />

        {/* Center — message thread + input */}
        <Panel minSize="35%">
          <CenterPanel />
        </Panel>

        <Separator className="w-px bg-border hover:bg-primary/30 transition-colors cursor-col-resize" />

        {/* Right — session info / workflow / analytics */}
        <Panel
          defaultSize={`${panelSizes.right}px`}
          minSize="18%"
          maxSize="35%"
          className="border-l border-border"
        >
          <RightPanel />
        </Panel>
      </Group>

      {/* Global overlays */}
      <CommandPalette />
      {settingsOpen && <SettingsOverlay />}

      {/* Toast notifications */}
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}
