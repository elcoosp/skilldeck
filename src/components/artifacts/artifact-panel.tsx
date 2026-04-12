import { useQuery } from '@tanstack/react-query'
import { FileCode } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { commands } from '@/lib/bindings'
import { useConversationStore } from '@/store/conversation'
import { ArtifactItem } from './artifact-item'
import { RightPanelHeader } from '@/components/layout/right-panel-header'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'

export function ArtifactPanel() {
  const activeConversationId = useConversationStore(
    (s) => s.activeConversationId
  )
  const activeBranchId = useConversationStore((s) => s.activeBranchId)

  const selectedArtifactId = useUIEphemeralStore((s) => s.selectedArtifactId)
  const setSelectedArtifactId = useUIEphemeralStore((s) => s.setSelectedArtifactId)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: artifacts, isLoading } = useQuery({
    queryKey: ['artifacts', activeConversationId, activeBranchId],
    queryFn: async () => {
      if (!activeConversationId) return []
      const res = await commands.listArtifacts(
        activeConversationId,
        activeBranchId
      )
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    enabled: !!activeConversationId
  })

  useEffect(() => {
    if (!selectedArtifactId || !containerRef.current) return

    console.log('[ArtifactPanel] Attempting to scroll to:', selectedArtifactId)

    // Try to scroll immediately
    const tryScroll = (): boolean => {
      const element = document.getElementById(`artifact-${selectedArtifactId}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        element.classList.add('artifact-highlight')
        setTimeout(() => {
          element.classList.remove('artifact-highlight')
          setSelectedArtifactId(null)
        }, 2000)
        return true
      }
      return false
    }

    if (!tryScroll()) {
      // Retry after a short delay (artifacts might still be loading)
      console.log('[ArtifactPanel] Element not found, retrying after 500ms...')
      const timer = setTimeout(() => {
        if (!tryScroll()) {
          console.warn('[ArtifactPanel] Element still not found after retry')
        }
        setSelectedArtifactId(null)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [selectedArtifactId, setSelectedArtifactId])

  if (!activeConversationId) {
    return (
      <div className="flex flex-col h-full">
        <RightPanelHeader title="Artifacts" />
        <EmptyState
          icon={FileCode}
          title="No active conversation"
          description="Select a conversation to view artifacts"
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <RightPanelHeader title="Artifacts" />
        <LoadingState message="Fetching generated files…" />
      </div>
    )
  }

  if (!artifacts || artifacts.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <RightPanelHeader title="Artifacts" />
        <EmptyState
          icon={FileCode}
          title="No artifacts"
          description="No artifacts generated yet. Ask the agent to create something!"
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0 min-w-0 overflow-hidden">
      <RightPanelHeader title="Artifacts" />
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 thin-scrollbar"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className="space-y-2 w-full min-w-0">
          {artifacts.map((artifact) => (
            <ArtifactItem key={artifact.id} artifact={artifact} />
          ))}
        </div>
      </div>
    </div>
  )
}
