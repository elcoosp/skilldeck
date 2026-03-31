import { Pin, PinOff } from 'lucide-react'
import { useState } from 'react'
import { commands } from '@/lib/bindings'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

interface PinIconProps {
  artifactId: string
  branchId: string | null
  isGlobal: boolean
  pinned: boolean
  onPinChange?: () => void
}

export function PinIcon({
  artifactId,
  branchId,
  isGlobal,
  pinned,
  onPinChange
}: PinIconProps) {
  const [loading, setLoading] = useState(false)
  const qc = useQueryClient()

  const togglePin = async () => {
    setLoading(true)
    try {
      if (pinned) {
        await commands.unpinArtifact(artifactId, branchId)
        toast.success('Unpinned')
      } else {
        await commands.pinArtifact(artifactId, branchId, isGlobal)
        toast.success('Pinned')
      }
      qc.invalidateQueries({ queryKey: ['pinned-artifacts'] })
      qc.invalidateQueries({ queryKey: ['global-pins'] })
      onPinChange?.()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={togglePin}
      disabled={loading}
      className="text-muted-foreground hover:text-foreground"
      title={pinned ? 'Unpin' : 'Pin'}
    >
      {pinned ? (
        <Pin className="size-3 fill-current" />
      ) : (
        <PinOff className="size-3" />
      )}
    </button>
  )
}
