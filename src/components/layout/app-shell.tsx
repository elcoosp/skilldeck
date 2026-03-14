/**
 * Main application shell — three-panel resizable layout.
 *
 * Keyboard shortcuts (2.3):
 *   Cmd/Ctrl+K          → Command palette
 *   Cmd/Ctrl+Shift+,    → Settings
 *   Cmd/Ctrl+N          → New conversation (delegated via store)
 *   Escape              → Close open overlays
 */

import { useCallback, useEffect } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Toaster } from 'sonner'
import { useHotkeys } from 'react-hotkeys-hook'
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
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen)

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  // Cmd/Ctrl+K — command palette
  useHotkeys('meta+k, ctrl+k', (e) => {
    e.preventDefault()
    setCommandPaletteOpen(true)
  })

  // Cmd/Ctrl+Shift+, — settings
  useHotkeys('meta+shift+comma, ctrl+shift+comma', (e) => {
    e.preventDefault()
    setSettingsOpen(true)
  })

  // Escape — close topmost overlay
  useHotkeys(
    'escape',
    (e) => {
      e.preventDefault()
      if (commandPaletteOpen) {
        setCommandPaletteOpen(false)
      } else if (settingsOpen) {
        setSettingsOpen(false)
      }
    },
    { enableOnFormTags: true }
  )

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

        {/* Right — session info / skills / mcp / workflow / analytics */}
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
