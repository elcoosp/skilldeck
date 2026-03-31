import { ArtifactData } from '@/lib/bindings'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileCode, FileText, Copy, GitCompare, Pin, PinOff } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { commands } from '@/lib/bindings'
import { BranchPicker } from './branch-picker'
import { VersionDiffModal } from './version-diff-modal'
import { cn } from '@/lib/utils'
import { useConversationStore } from '@/store/conversation'

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
  const Icon = artifact.type === 'code' ? FileCode : FileText
  const qc = useQueryClient()
  const activeConversationId = useConversationStore(
    (s) => s.activeConversationId
  )
  const activeBranchId = useConversationStore((s) => s.activeBranchId)

  const [showBranchPicker, setShowBranchPicker] = useState(false)
  const [copying, setCopying] = useState(false)
  const [showDiff, setShowDiff] = useState(false)

  // State for the consolidated pin dropdown
  const [showPinMenu, setShowPinMenu] = useState(false)
  const [pinMenuPos, setPinMenuPos] = useState<{
    top: number
    left: number
  } | null>(null)
  const pinButtonRef = useRef<HTMLButtonElement>(null)
  const pinMenuRef = useRef<HTMLDivElement>(null)

  // Fetch pinned status for this artifact in current branch
  const { data: branchPins, refetch: refetchBranchPins } = useQuery({
    queryKey: ['pinned-artifacts', activeConversationId, activeBranchId],
    queryFn: async () => {
      if (!activeConversationId) return []
      const res = await commands.listPinnedArtifacts(
        activeConversationId,
        activeBranchId
      )
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    enabled: !!activeConversationId && !!activeBranchId
  })
  const isBranchPinned = branchPins?.some((p) => p.id === artifact.id) ?? false

  // Fetch global pinned status
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

  // Close pin menu when clicking outside
  useEffect(() => {
    if (!showPinMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        pinMenuRef.current &&
        !pinMenuRef.current.contains(e.target as Node) &&
        pinButtonRef.current &&
        !pinButtonRef.current.contains(e.target as Node)
      ) {
        setShowPinMenu(false)
        setPinMenuPos(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPinMenu])

  // Fetch versions for diff
  const { data: versions } = useQuery({
    queryKey: ['artifact-versions', artifact.id],
    queryFn: async () => {
      const res = await commands.listArtifactVersions(artifact.id)
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    enabled: !!artifact.logical_key
  })

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

  const isPinned = isBranchPinned || isGlobalPinned

  const handlePinClick = useCallback(() => {
    if (showPinMenu) {
      setShowPinMenu(false)
      setPinMenuPos(null)
      return
    }

    const btn = pinButtonRef.current
    if (!btn) return

    const rect = btn.getBoundingClientRect()
    setPinMenuPos({
      top: rect.top,
      left: rect.right + 4 // Position to the right with a small gap
    })
    setShowPinMenu(true)
  }, [showPinMenu])

  return (
    <div className="w-full min-w-0 rounded-lg border border-border p-2 hover:bg-muted/30 transition-colors overflow-hidden">
      <div className="flex items-start gap-2">
        <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <p className="text-xs font-medium truncate">{artifact.name}</p>
            {!compact && (
              <>
                <button
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => setShowBranchPicker(!showBranchPicker)}
                  disabled={copying}
                  title="Copy to branch"
                >
                  <Copy className="size-3" />
                </button>
                {versions && versions.length >= 2 && (
                  <button
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => setShowDiff(true)}
                    title="Compare versions"
                  >
                    <GitCompare className="size-3" />
                  </button>
                )}

                {/* Single Pin button with portal dropdown opening on the right */}
                <div className="relative shrink-0">
                  <button
                    ref={pinButtonRef}
                    className={cn(
                      'text-muted-foreground hover:text-foreground transition-colors',
                      isPinned && 'text-primary'
                    )}
                    onClick={handlePinClick}
                    title={isPinned ? 'Manage pins' : 'Pin artifact'}
                  >
                    {isPinned ? (
                      <Pin className="size-3 fill-current" />
                    ) : (
                      <PinOff className="size-3" />
                    )}
                  </button>

                  {showPinMenu &&
                    pinMenuPos &&
                    createPortal(
                      <div
                        ref={pinMenuRef}
                        className="fixed z-50 w-40 bg-popover border border-border rounded-md shadow-md py-1 text-xs"
                        style={{
                          top: `${pinMenuPos.top}px`,
                          left: `${pinMenuPos.left}px`
                        }}
                      >
                        <button
                          className="w-full text-left px-2 py-1.5 hover:bg-muted/50 flex items-center justify-between transition-colors whitespace-nowrap"
                          onClick={() => {
                            handlePinBranch()
                            setShowPinMenu(false)
                            setPinMenuPos(null)
                          }}
                        >
                          <span>Pin to Branch</span>
                          {isBranchPinned && (
                            <span className="text-primary font-semibold ml-2">
                              ✓
                            </span>
                          )}
                        </button>
                        <button
                          className="w-full text-left px-2 py-1.5 hover:bg-muted/50 flex items-center justify-between transition-colors whitespace-nowrap"
                          onClick={() => {
                            handlePinGlobal()
                            setShowPinMenu(false)
                            setPinMenuPos(null)
                          }}
                        >
                          <span>Pin Globally</span>
                          {isGlobalPinned && (
                            <span className="text-primary font-semibold ml-2">
                              ✓
                            </span>
                          )}
                        </button>
                      </div>,
                      document.body
                    )}
                </div>
              </>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {artifact.language ? `${artifact.language} · ` : ''}
            {new Date(artifact.created_at).toLocaleString()}
          </p>
          {!compact && (
            <pre className="mt-1 text-[10px] text-muted-foreground bg-muted/30 p-1 rounded truncate max-h-12 overflow-hidden w-full min-w-0">
              {artifact.content.slice(0, 100)}...
            </pre>
          )}
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
    </div>
  )
}
