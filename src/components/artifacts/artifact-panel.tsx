import { useQuery } from '@tanstack/react-query'
import { FileCode, Loader2 } from 'lucide-react'
import { commands } from '@/lib/bindings'
import { useConversationStore } from '@/store/conversation'
import { ArtifactItem } from './artifact-item'
import { RightPanelHeader } from '@/components/layout/right-panel-header'
import { EmptyState } from '@/components/ui/empty-state'

export function ArtifactPanel() {
  const activeConversationId = useConversationStore(
    (s) => s.activeConversationId
  )
  const activeBranchId = useConversationStore((s) => s.activeBranchId)

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
        <div className="flex-1 flex justify-center p-3">
          <Loader2 className="animate-spin size-4 text-muted-foreground" />
        </div>
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
          description="Artifacts generated during conversations will appear here"
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0 min-w-0 overflow-hidden">
      <RightPanelHeader title="Artifacts" />
      <div
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
