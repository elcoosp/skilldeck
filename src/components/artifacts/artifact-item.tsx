import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistance } from 'date-fns'
import { Copy, GitCompare, MoreHorizontal, Pin, PinOff } from 'lucide-react'
import { FileIcon } from '@react-symbols/icons/utils'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from '@/components/ui/toast'
import { type ArtifactData, commands } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import { useConversationStore } from '@/store/conversation'
import { BranchPicker } from './branch-picker'
import { VersionDiffModal } from './version-diff-modal'

interface ArtifactItemProps {
  artifact: ArtifactData
  compact?: boolean
  onPinChange?: () => void
}

export function ArtifactItem({
  artifact,
  compact = false,
  onPinChange
}: ArtifactItemProps) {
  const displayName = artifact.file_path || artifact.name || 'Untitled'

  const qc = useQueryClient()
  const activeConversationId = useConversationStore((s) => s.activeConversationId)
  const activeBranchId = useConversationStore((s) => s.activeBranchId)

  const [showBranchPicker, setShowBranchPicker] = useState(false)
  const [copying, setCopying] = useState(false)
  const [showDiff, setShowDiff] = useState(false)

  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const { data: branchPins, refetch: refetchBranchPins } = useQuery({
    queryKey: ['pinned-artifacts', activeConversationId, activeBranchId],
    queryFn: async () => {
      if (!activeConversationId) return []
      const res = await commands.listPinnedArtifacts(activeConversationId, activeBranchId)
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    enabled: !!activeConversationId && !!activeBranchId
  })
  const isBranchPinned = branchPins?.some((p) => p.id === artifact.id) ?? false

  const { data: globalPins, refetch: refetchGlobalPins } = useQuery({
    queryKey: ['global-pins', activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return []
      const res = await commands.listPinnedArtifacts(activeConversationId, null)
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    enabled: !!activeConversationId
  })
  const isGlobalPinned = globalPins?.some((p) => p.id === artifact.id) ?? false

  const { data: versions } = useQuery({
    queryKey: ['artifact-versions', artifact.id],
    queryFn: async () => {
      const res = await commands.listArtifactVersions(artifact.id)
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    enabled: !!artifact.logical_key
  })

  const relativeTime = formatDistance(new Date(artifact.created_at), new Date(), {
    addSuffix: true
  })

  useEffect(() => {
    if (!showActionsMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target as Node)
      ) {
        setShowActionsMenu(false)
        setMenuPos(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showActionsMenu])

  const handleCopy = async (branchId: string) => {
    setCopying(true)
    try {
      const res = await commands.copyArtifactToBranch(artifact.id, branchId)
      if (res.status === 'ok') {
        toast.success(`Artifact copied to branch`)
        setShowBranchPicker(false)
      } else {
        toast.error(res.error)
      }
    } catch (err) {
      toast.error(String(err))
    } finally {
      setCopying(false)
    }
  }

  const handlePinBranch = async () => {
    try {
      if (isBranchPinned) {
        await commands.unpinArtifact(artifact.id, activeBranchId)
        toast.success('Unpinned from this branch')
      } else {
        await commands.pinArtifact(artifact.id, activeBranchId, false)
        toast.success('Pinned to this branch')
      }
      await refetchBranchPins()
      onPinChange?.()
      qc.invalidateQueries({ queryKey: ['pinned-artifacts'] })
    } catch (err) {
      toast.error(String(err))
    }
  }

  const handlePinGlobal = async () => {
    try {
      if (isGlobalPinned) {
        await commands.unpinArtifact(artifact.id, null)
        toast.success('Unpinned globally')
      } else {
        await commands.pinArtifact(artifact.id, null, true)
        toast.success('Pinned globally')
      }
      await refetchGlobalPins()
      onPinChange?.()
      qc.invalidateQueries({ queryKey: ['global-pins'] })
    } catch (err) {
      toast.error(String(err))
    }
  }

  const handleMenuClick = useCallback(() => {
    if (showActionsMenu) {
      setShowActionsMenu(false)
      setMenuPos(null)
      return
    }

    const btn = menuButtonRef.current
    if (!btn) return

    const rect = btn.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.right - 120
    })
    setShowActionsMenu(true)
  }, [showActionsMenu])

  return (
    <div id={`artifact-${artifact.id}`} className="w-full min-w-0 rounded-lg border border-border p-2 hover:bg-muted/30 transition-colors overflow-hidden">
      <div className="flex items-start gap-2">
        {artifact.file_path ? (
          <FileIcon fileName={artifact.file_path} className="size-4 text-muted-foreground mt-0.5 shrink-0" />
        ) : (
          <div className="size-4 mt-0.5 shrink-0 bg-muted rounded-sm flex items-center justify-center text-[10px] text-muted-foreground">
            {artifact.type === 'code' ? '</>' : 'T'}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1">
            <span
              className={cn(
                "text-xs font-medium break-all",
                artifact.file_path && "font-mono text-primary"
              )}
              title={displayName}
            >
              {displayName}
            </span>
            {!compact && (
              <button
                ref={menuButtonRef}
                className="text-muted-foreground hover:text-foreground shrink-0 ml-auto"
                onClick={handleMenuClick}
                title="Actions"
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {relativeTime}
            {artifact.language && ` · ${artifact.language}`}
          </p>
        </div>
      </div>

      {showBranchPicker && (
        <div className="mt-2">
          <BranchPicker
            conversationId={activeConversationId!}
            onSelect={handleCopy}
            disabled={copying}
          />
        </div>
      )}

      {showDiff && versions && (
        <VersionDiffModal
          open={showDiff}
          onClose={() => setShowDiff(false)}
          versions={versions}
        />
      )}

      {showActionsMenu && menuPos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 w-48 bg-popover border border-border rounded-md shadow-md py-1 text-xs"
          style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
        >
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors flex items-center gap-2"
            onClick={() => {
              setShowBranchPicker(true)
              setShowActionsMenu(false)
              setMenuPos(null)
            }}
            disabled={copying}
          >
            <Copy className="size-3.5" />
            <span>Copy to branch...</span>
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors flex items-center gap-2"
            onClick={() => {
              handlePinBranch()
              setShowActionsMenu(false)
              setMenuPos(null)
            }}
          >
            {isBranchPinned ? (
              <PinOff className="size-3.5" />
            ) : (
              <Pin className="size-3.5" />
            )}
            <span className="flex-1">
              {isBranchPinned ? 'Unpin from this branch' : 'Pin to this branch'}
            </span>
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors flex items-center gap-2"
            onClick={() => {
              handlePinGlobal()
              setShowActionsMenu(false)
              setMenuPos(null)
            }}
          >
            {isGlobalPinned ? (
              <PinOff className="size-3.5" />
            ) : (
              <Pin className="size-3.5" />
            )}
            <span className="flex-1">
              {isGlobalPinned ? 'Unpin globally' : 'Pin globally'}
            </span>
          </button>
          {versions && versions.length >= 2 && (
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors flex items-center gap-2"
              onClick={() => {
                setShowDiff(true)
                setShowActionsMenu(false)
                setMenuPos(null)
              }}
            >
              <GitCompare className="size-3.5" />
              <span>Compare versions...</span>
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
