import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { commands } from '@/lib/bindings'
import { useConversationStore } from '@/store/conversation'
import { ArtifactItem } from './artifact-item'

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
      <div className="p-4 text-muted-foreground text-sm">
        No active conversation.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="animate-spin size-4 text-muted-foreground" />
      </div>
    )
  }

  if (!artifacts || artifacts.length === 0) {
    return (
      <div className="p-4 text-muted-foreground text-sm">
        No artifacts in this branch.
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0 min-w-0 overflow-hidden">
      <div
        className="h-full overflow-y-auto overflow-x-hidden p-4 thin-scrollbar"
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
