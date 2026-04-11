// src/components/layout/app-shell.tsx
import { useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Group, type Layout, Panel, Separator } from 'react-resizable-panels'
import { Toaster } from '@/components/ui/toast'
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
import {
  DragDropProvider,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type DragDropManager,
} from '@dnd-kit/react'
import { useChatContextStore } from '@/store/chat-context-store'
import { useConversationStore } from '@/store/conversation'
import { commands } from '@/lib/bindings'
import { toast } from '@/components/ui/toast'
import { FileIcon } from '@react-symbols/icons/utils'

const LAYOUT_STORAGE_KEY = 'skilldeck-panel-layout'

const PANEL_LEFT = 'left'
const PANEL_CENTER = 'center'
const PANEL_RIGHT = 'right'

const DEFAULT_LAYOUT: Layout = {
  [PANEL_LEFT]: 25,
  [PANEL_CENTER]: 50,
  [PANEL_RIGHT]: 25
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
    } catch { }
    return DEFAULT_LAYOUT
  })

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

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleLayoutChanged = useCallback(
    (newLayout: Layout) => {
      setLayout(newLayout)

      const totalWidth = window.innerWidth
      const leftPx = Math.round(((newLayout[PANEL_LEFT] ?? 20) / 100) * totalWidth)
      const rightPx = Math.round(((newLayout[PANEL_RIGHT] ?? 20) / 100) * totalWidth)
      const centerPx = Math.max(35, totalWidth - leftPx - rightPx - 2)

      setPanelSizesPx({
        left: leftPx,
        center: centerPx,
        right: rightPx
      })

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(newLayout))
      }, 300)
    },
    [setPanelSizesPx]
  )

  const setCommandPaletteOpen = useUIOverlaysStore((s) => s.setCommandPaletteOpen)
  const setGlobalSearchOpen = useUIOverlaysStore((s) => s.setGlobalSearchOpen)

  usePlatformRegistration()
  useNudgeListener()

  useHotkeys('meta+k, ctrl+k', () => setCommandPaletteOpen(true))
  useHotkeys(['meta+,', 'ctrl+,'], () => router.navigate({ to: '/settings/api-keys' }))
  useHotkeys('meta+shift+f, ctrl+shift+f', () => setGlobalSearchOpen(true))

  const [activeDragItem, setActiveDragItem] = useState<{
    type: 'file'
    path: string
    name: string
  } | null>(null)

  const handleDragStart = (
    event: { operation: { source: any } },
    _manager: DragDropManager
  ) => {
    console.log('[AppShell] onDragStart', {
      source: event.operation?.source,
      sourceData: event.operation?.source?.data,
    })
    const source = event.operation?.source
    if (source?.data?.type === 'file') {
      setActiveDragItem({
        type: 'file',
        path: source.data.path,
        name: source.data.name,
      })
      console.log('[AppShell] Active drag item set:', source.data)
    } else {
      console.warn('[AppShell] Source is not a file:', source?.data)
    }
  }

  const handleDragEnd = (
    event: { operation: { source: any; target: any }; canceled: boolean },
    _manager: DragDropManager
  ) => {
    console.log('[AppShell] onDragEnd', {
      source: event.operation?.source,
      target: event.operation?.target,
      canceled: event.canceled,
    })
    const { source, target } = event.operation
    setActiveDragItem(null)

    if (event.canceled) {
      console.log('[AppShell] Drag canceled')
      return
    }
    if (!target) {
      console.log('[AppShell] No drop target')
      return
    }

    const conversationId = target.data?.conversationId
    if (!conversationId) {
      console.warn('[AppShell] Target has no conversationId:', target.data)
      return
    }

    const sourceData = source?.data
    if (sourceData?.type !== 'file') {
      console.warn('[AppShell] Source is not a file:', sourceData)
      return
    }

    const filePath = sourceData.path
    if (!filePath) return

    console.log('[AppShell] Dropped file on conversation:', {
      filePath,
      conversationId,
    })

    commands
      .attachFilesToConversation(conversationId, [filePath])
      .then((res) => {
        if (res.status === 'error') {
          toast.error(res.error)
        } else {
          toast.success(`Attached "${sourceData.name}" to conversation`)

          const addFile = useChatContextStore.getState().addFile
          addFile(conversationId, {
            id: filePath,
            name: sourceData.name,
            path: filePath,
            size: undefined,
          })

          const activeConvId = useConversationStore.getState().activeConversationId
          if (activeConvId !== conversationId) {
            useConversationStore.getState().setActiveConversation(conversationId)
          }
        }
      })
      .catch(() => toast.error('Failed to attach file'))
  }

  const handleDragMove = (event: any) => {
    console.log('[AppShell] onDragMove', event)
  }
  return (
    <DragDropProvider

      onDragMove={handleDragMove} sensors={[PointerSensor, KeyboardSensor]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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
        <Toaster position="bottom-right" />
      </div>

      <DragOverlay>
        {activeDragItem ? (
          <div className="flex items-center gap-2 rounded-md bg-background border border-border shadow-lg px-3 py-2 text-sm">
            <FileIcon fileName={activeDragItem.name} width={16} height={16} />
            <span>{activeDragItem.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DragDropProvider>
  )
}
