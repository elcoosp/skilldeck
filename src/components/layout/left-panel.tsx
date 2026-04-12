// src/components/layout/left-panel.tsx
/**
 * Left panel — completely remade UX:
 * - Narrow vertical band (min-w-[64px], pt-8 pb-4) with workspace avatar stack + bottom icons
 * - border-r border-border kept for the visible delimiter, with a gradient overlay on the top 1/7 to fade it
 * - All workspaces shown as clickable avatar circles (active one highlighted)
 * - "+" button to open/add a new workspace
 * - Sort toggle (F04): switch between updated/created order
 * - Open in Editor button (F08): opens workspace in preferred editor
 * - Main area — fully responsive conversation list
 * - Conversations filtered by currently selected workspace only
 * - Workspace avatars use customisable gradients with click‑edit card
 */

import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { open } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpDown,
  ChevronDown,
  Code2,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Settings,
  X
} from 'lucide-react'
import { Collapsible } from 'radix-ui'
import { useEffect, useState } from 'react'
import { toast } from '@/components/ui/toast'
import { ConversationItem } from '@/components/conversation/conversation-item'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  useConversations,
  useCreateConversation
} from '@/hooks/use-conversations'
import { useExpandedDateGroups } from '@/hooks/use-expanded-date-groups'
import { useCreateFolder, useFolders } from '@/hooks/use-folders'
import { useLeftPanelSearch } from '@/hooks/use-left-panel-search'
import { useProfileFilter } from '@/hooks/use-profile-filter'
import { useProfiles } from '@/hooks/use-profiles'
import {
  useOpenWorkspace,
  useUpdateWorkspace,
  useWorkspaces
} from '@/hooks/use-workspaces'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settings'
import { useUIOverlaysStore } from '@/store/ui-overlays'
import { useWorkspaceStore } from '@/store/workspace'

// ----------------------------------------------------------------------
// Date grouping helper
// ----------------------------------------------------------------------
import { isToday, isValid, isYesterday, parseISO, subDays } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

function getDateGroupKey(dateStr: string): string {
  const normalized = dateStr
    .replace(' ', 'T')
    .replace(' +', '+')
    .replace(' -', '-')
  const date = parseISO(normalized)
  if (!isValid(date)) return 'Older'
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  if (date > subDays(new Date(), 7)) return 'Last 7 days'
  if (date > subDays(new Date(), 30)) return 'Last 30 days'
  return 'Older'
}

// ----------------------------------------------------------------------
// Empty state animation
// ----------------------------------------------------------------------
interface EmptyStateAnimationProps {
  alt: string
  className?: string
}

function EmptyStateAnimation({ alt, className }: EmptyStateAnimationProps) {
  const [hasError, setHasError] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  if (prefersReducedMotion || hasError) {
    return (
      <img
        src="/illustrations/empty-conversations.svg"
        alt={alt}
        className={className}
      />
    )
  }

  return (
    <DotLottieReact
      src="/illustrations/empty-conversations.lottie"
      autoplay
      className={className}
      onError={() => setHasError(true)}
      aria-label={alt}
    />
  )
}

// ----------------------------------------------------------------------
// Gradient presets for workspace avatars
// ----------------------------------------------------------------------
const GRADIENT_PRESETS = [
  { name: 'Instagram', value: 'linear-gradient(115deg, #f9ce34, #ee2a7b, #6228d7)' },
  { name: 'Midnight Splash', value: 'linear-gradient(115deg, #004ff9, #000000)' },
  { name: 'Blue Sky', value: 'linear-gradient(115deg, #62cff4, #2c67f2)' },
  { name: 'Dreamscape Delight', value: 'linear-gradient(115deg, #fa8bff, #2bd2ff, #2bff88)' },
  { name: 'Pastel Dream', value: 'linear-gradient(115deg, #d16ba5, #86a8e7, #5ffbf1)' },
  { name: 'Almond Breeze', value: 'linear-gradient(115deg, #fdfcfb, #e2d1c3)' },
  { name: 'Mars', value: 'linear-gradient(115deg, #2c3e52, #fd746a)' },
  { name: 'Sunset Glow', value: 'linear-gradient(115deg, #4158d0, #c850c0, #ffcc70)' },
  { name: 'Purple Dreams', value: 'linear-gradient(115deg, #fab2ff, #1904e5)' },
  { name: 'Autumn Blaze', value: 'linear-gradient(115deg, #fec163, #de4313)' },
  { name: 'Mint Night', value: 'linear-gradient(115deg, #92ffc0, #002661)' },
  { name: 'Midnight Rain', value: 'linear-gradient(115deg, #12063b, #09555c)' },
  { name: 'Amber Eclipse', value: 'linear-gradient(115deg, #ffa600, #ff6361, #003f5c)' },
  { name: 'Deep Space', value: 'linear-gradient(115deg, #000000, #444444)' },
  { name: 'Aqua Reef', value: 'linear-gradient(115deg, #3cc5d7, #47d794)' },
  { name: 'Sunset Coral', value: 'linear-gradient(115deg, #fe5f75, #fc9840)' },
  { name: 'Spring Meadow', value: 'linear-gradient(115deg, #c5f9d7, #f7d486, #f27a7d)' },
  { name: 'Electric Blue', value: 'linear-gradient(115deg, #004ff9, #fff94c)' },
  { name: 'Verdant Depth', value: 'linear-gradient(115deg, #00bf8f, #001510)' },
  { name: 'Plum Passion', value: 'linear-gradient(115deg, #662d8c, #ed1e79)' },
  { name: 'Tennis Ball', value: 'linear-gradient(115deg, #5efce8, #736efe)' },
  { name: 'Neon Fusion', value: 'linear-gradient(115deg, #f97794, #6200ff, #3498db)' },
  { name: 'Frosted Glass', value: 'linear-gradient(115deg, #ffffff, #d4dfed)' },
  { name: 'Cotton Candy', value: 'linear-gradient(115deg, #f878ff, #ffda9e, #ffffff)' },
  { name: 'Lemon Lime', value: 'linear-gradient(115deg, #16a085, #f4d03f)' },
  { name: 'Ocean Depth', value: 'linear-gradient(115deg, #2c3e50, #58b8c7)' },
  { name: 'Arctic Aurora', value: 'linear-gradient(115deg, #5efce8, #736efe)' },
  { name: 'Ember Glow', value: 'linear-gradient(115deg, #ff512f, #dd2476)' },
  { name: 'Berry Smoothie', value: 'linear-gradient(115deg, #f97794, #623aa2, #111111)' },
  { name: 'Volcanic Heat', value: 'linear-gradient(115deg, #e6220c, #ffad5c)' },
  { name: 'Golden Hour', value: 'linear-gradient(115deg, #eece13, #b210ff)' },
  { name: 'Bliss', value: 'linear-gradient(115deg, #ef629a, #eecda1)' },
  { name: 'Solar Flare', value: 'linear-gradient(115deg, #f5f523, #2c3e50)' },
  { name: 'Silver Lining', value: 'linear-gradient(115deg, #ffffff, #dddddd)' },
  { name: 'Azure Radiance', value: 'linear-gradient(115deg, #3c8ce7, #00eaff)' },
  { name: 'Coastal Mist', value: 'linear-gradient(115deg, #4ca1af, #c4e0e5)' },
  { name: 'Cyberpunk', value: 'linear-gradient(115deg, #00c3ff, #ffff1c)' },
  { name: 'Neon Pulse', value: 'linear-gradient(115deg, #ff004c, #ffffff, #0099ff)' },
  { name: 'Smoke & Ash', value: 'linear-gradient(115deg, #d7d2c9, #222222)' },
  { name: 'Tropical Punch', value: 'linear-gradient(115deg, #abffee, #3d00a6, #000e17)' },
  { name: 'Psychedelic Pop', value: 'linear-gradient(115deg, #62cff4, #ff00ff)' },
  { name: 'Rose Mist', value: 'linear-gradient(115deg, #ffc6df, #60b9fc)' },
  { name: 'Desert Sand', value: 'linear-gradient(115deg, #a07361, #eed7b2)' },
  { name: 'Skyline', value: 'linear-gradient(115deg, #abdcff, #0396ff)' },
  { name: 'Blush', value: 'linear-gradient(115deg, #ffffff, #ffe3fb)' },
  { name: 'Grape Soda', value: 'linear-gradient(115deg, #75188f, #75167a, #410a47)' },
  { name: 'Mango Tango', value: 'linear-gradient(115deg, #59cc4d, #ffcd00, #ff5f00)' },
  { name: 'Lime Twist', value: 'linear-gradient(115deg, #d8e547, #56d388)' },
  { name: 'Crimson Dusk', value: 'linear-gradient(115deg, #262935, #b30938)' },
  { name: 'Sea Breeze', value: 'linear-gradient(115deg, #538ad6, #86e7d6)' },
  { name: 'Soft Petals', value: 'linear-gradient(115deg, #f1a7f1, #fad0c4)' },
  { name: 'Void', value: 'linear-gradient(115deg, #000000, #00f7ff)' },
  { name: 'Dusk Till Dawn', value: 'linear-gradient(115deg, #614385, #516395)' },
  { name: 'Deep Lagoon', value: 'linear-gradient(115deg, #141e30, #243b55)' },
  { name: 'Peach Fizz', value: 'linear-gradient(115deg, #fff6b7, #f6416c)' },
  { name: 'Lavender Haze', value: 'linear-gradient(115deg, #b58ecc, #5de6de)' },
  { name: 'Raspberry Ripple', value: 'linear-gradient(115deg, #2e4fc6, #ed4182)' },
  { name: 'Electric Jungle', value: 'linear-gradient(115deg, #22f9c4, #f91894)' },
  { name: 'Cyber Mint', value: 'linear-gradient(115deg, #1dfffb, #cf1bb1)' }
]
const DEFAULT_GRADIENT = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'

// ----------------------------------------------------------------------
// Helper: get avatar style from workspace
// ----------------------------------------------------------------------
function getWorkspaceAvatarStyle(workspace: { avatar_style?: string }): React.CSSProperties {
  return { background: workspace.avatar_style || DEFAULT_GRADIENT }
}

// ----------------------------------------------------------------------
// Helper: adjust hex color for custom gradient
// ----------------------------------------------------------------------
function adjustColor(hex: string, percent: number): string {
  let R = parseInt(hex.substring(1, 3), 16)
  let G = parseInt(hex.substring(3, 5), 16)
  let B = parseInt(hex.substring(5, 7), 16)
  R = Math.min(255, Math.max(0, R + percent))
  G = Math.min(255, Math.max(0, G + percent))
  B = Math.min(255, Math.max(0, B + percent))
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`
}

// ----------------------------------------------------------------------
// Inline workspace avatar editor (card)
// ----------------------------------------------------------------------
interface WorkspaceAvatarEditorProps {
  workspace: { id: string; avatar_style?: string }
  onClose: () => void
}

function WorkspaceAvatarEditor({ workspace, onClose }: WorkspaceAvatarEditorProps) {
  const updateWorkspace = useUpdateWorkspace()
  const [customColor, setCustomColor] = useState('#6366f1')

  const handleSelectGradient = (gradient: string) => {
    updateWorkspace.mutate(
      { id: workspace.id, avatar_style: gradient },
      {
        onSuccess: () => {
          toast.success('Workspace appearance updated')
          onClose()
        }
      }
    )
  }

  const handleApplyCustom = () => {
    const customGradient = `linear-gradient(135deg, ${customColor} 0%, ${adjustColor(customColor, 20)} 100%)`
    updateWorkspace.mutate(
      { id: workspace.id, avatar_style: customGradient },
      {
        onSuccess: () => {
          toast.success('Workspace appearance updated')
          onClose()
        }
      }
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Avatar style</h4>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {GRADIENT_PRESETS.map((preset) => (
          <button
            key={preset.name}
            className="w-8 h-8 rounded-full border border-border hover:scale-110 transition-transform disabled:opacity-50"
            style={{ background: preset.value }}
            title={preset.name}
            onClick={() => handleSelectGradient(preset.value)}
            disabled={updateWorkspace.isPending}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value)}
          className="w-8 h-8 p-1 rounded-full"
          disabled={updateWorkspace.isPending}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleApplyCustom}
          disabled={updateWorkspace.isPending}
          className="relative"
        >
          {updateWorkspace.isPending && (
            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
          )}
          Apply custom
        </Button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------
// Workspace avatar component (with edit button that opens card)
// ----------------------------------------------------------------------
interface WorkspaceAvatarProps {
  workspace: { id: string; name: string; is_open: boolean; avatar_style?: string }
  isActive: boolean
  onSwitch: (workspace: { id: string; name: string; is_open: boolean }) => void
}
function WorkspaceAvatar({ workspace, isActive, onSwitch }: WorkspaceAvatarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const initials = workspace.name ? workspace.name.slice(0, 2).toUpperCase() : '??'
  const avatarStyle = getWorkspaceAvatarStyle(workspace)

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={() => onSwitch(workspace)}
        title={workspace.is_open ? workspace.name : `${workspace.name} (closed)`}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm transition-transform duration-150 ease-out hover:scale-105 focus:outline-none shrink-0',
          isActive
            ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md'
            : 'opacity-70 hover:opacity-100'
        )}
        style={avatarStyle}
      >
        {initials}
      </button>

      {/* Popover with edit button as trigger – always present, open state controlled */}
      <Popover open={isEditing} onOpenChange={setIsEditing}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'absolute -top-1 -right-1 w-5 h-5 bg-background border border-border rounded-full flex items-center justify-center shadow-sm hover:bg-muted transition-colors z-10',
              isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
            aria-label="Edit workspace appearance"
          >
            <Pencil className="size-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          className="w-64 p-3"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <WorkspaceAvatarEditor
            workspace={workspace}
            onClose={() => setIsEditing(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
// ----------------------------------------------------------------------
// Main component
// ----------------------------------------------------------------------
export function LeftPanel() {
  const router = useRouter()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const queryClient = useQueryClient()

  // Store & UI state
  const setGlobalSearchOpen = useUIOverlaysStore((s) => s.setGlobalSearchOpen)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)

  const { leftSearch, setLeftSearch } = useLeftPanelSearch()
  const { expandedDateGroups, toggleDateGroup } = useExpandedDateGroups()
  const { profileId, setProfileId } = useProfileFilter()

  // F04: Sort preference from settings store
  const conversationSort =
    useSettingsStore((s) => s.conversationSort) ?? 'updated'
  // F08: Preferred editor from settings store
  const preferredEditor = useSettingsStore((s) => s.preferredEditor) ?? 'system'

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Data hooks
  const { data: workspaces = [] } = useWorkspaces()
  const openWorkspace = useOpenWorkspace()
  const updateWorkspace = useUpdateWorkspace()
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  const { data: profiles = [] } = useProfiles(false)
  const { data: allProfiles, isLoading: profilesLoading } = useProfiles(true)
  const defaultProfile =
    allProfiles?.find((p) => p.is_default) ?? allProfiles?.[0]

  // Fetch all conversations (across all workspaces) then filter by current workspace
  const { data: allConversations, isLoading: conversationsLoading } =
    useConversations(profileId)
  const workspaceConversations =
    allConversations?.filter((c) => c.workspace_id === activeWorkspaceId) ?? []

  const { data: folders = [], isLoading: foldersLoading } = useFolders()
  const createFolder = useCreateFolder()
  const createConversation = useCreateConversation(defaultProfile?.id)

  // Apply search filter client-side on workspace-filtered conversations
  const filtered = workspaceConversations.filter((c) =>
    leftSearch
      ? (c.title ?? '').toLowerCase().includes(leftSearch.toLowerCase())
      : true
  )

  // F04: Sort by the user's chosen field before splitting into pinned/unpinned
  const sorted = [...filtered].sort((a, b) => {
    const field = conversationSort === 'updated' ? 'updated_at' : 'created_at'
    return new Date(b[field]).getTime() - new Date(a[field]).getTime()
  })

  // Pinned, folders, date groups
  const pinnedConversations = sorted.filter((c) => c.pinned)
  const unpinned = sorted.filter((c) => !c.pinned)

  const conversationsByFolder = new Map<string, typeof unpinned>()
  const conversationsWithoutFolder: typeof unpinned = []
  for (const conv of unpinned) {
    if (conv.folder_id) {
      const list = conversationsByFolder.get(conv.folder_id) || []
      list.push(conv)
      conversationsByFolder.set(conv.folder_id, list)
    } else {
      conversationsWithoutFolder.push(conv)
    }
  }

  const groupedByDate: Record<string, typeof unpinned> = {}
  for (const conv of conversationsWithoutFolder) {
    const key = getDateGroupKey(conv.updated_at)
    if (!groupedByDate[key]) groupedByDate[key] = []
    groupedByDate[key].push(conv)
  }

  const isLoading = profilesLoading || conversationsLoading || foldersLoading

  // Workspace actions
  const handleSwitchWorkspace = async (workspace: (typeof workspaces)[0]) => {
    if (!workspace.is_open) {
      try {
        const reopened = await openWorkspace.mutateAsync(workspace.path)
        setActiveWorkspace(reopened.id)
        toast.success(`Switched to ${reopened.name}`)
      } catch (err) {
        toast.error(`Failed to open workspace: ${err}`)
      }
    } else {
      setActiveWorkspace(workspace.id)
      toast.success(`Switched to ${workspace.name}`)
    }
  }

  const handleOpenWorkspace = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select workspace folder'
      })
      if (!selected) return
      const workspace = await openWorkspace.mutateAsync(selected)
      setActiveWorkspace(workspace.id)

      // Assign a random gradient from presets to the new workspace
      const randomPreset = GRADIENT_PRESETS[Math.floor(Math.random() * GRADIENT_PRESETS.length)]
      updateWorkspace.mutate(
        { id: workspace.id, avatar_style: randomPreset.value },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workspaces'] })
          }
        }
      )

      toast.success(`Workspace opened: ${workspace.name}`)
    } catch (err) {
      toast.error(`Could not open workspace: ${err}`)
    }
  }

  // F08: Open workspace in preferred editor
  const handleOpenInEditor = async () => {
    if (!activeWorkspace) return
    const path = activeWorkspace.path
    const editorSchemes: Record<string, string> = {
      vscode: `vscode://file/${path}`,
      cursor: `cursor://file/${path}`
    }
    const url = editorSchemes[preferredEditor] ?? `file://${path}`
    try {
      await openUrl(url)
    } catch {
      toast.error('Could not open editor')
    }
  }

  // F04: Toggle sort
  const handleToggleSort = () => {
    useSettingsStore
      .getState()
      .setConversationSort(
        conversationSort === 'updated' ? 'created' : 'updated'
      )
  }

  const handleNewChat = () => {
    if (!defaultProfile) {
      toast.error('No profile found. Add one in Settings.')
      return
    }
    if (!activeWorkspace) {
      toast.error('No workspace selected. Open or create a workspace first.')
      return
    }
    createConversation.mutate({ title: undefined })
  }

  const handleDeleteStart = (conversationId: string) =>
    setDeletingId(conversationId)
  const handleDeleteComplete = () => setDeletingId(null)

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await createFolder.mutateAsync(newFolderName.trim())
      setNewFolderName('')
      setShowNewFolderInput(false)
      toast.success('Folder created')
    } catch (err) {
      toast.error(`Failed to create folder: ${err}`)
    }
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Narrow vertical band — workspace avatar stack + bottom icons */}
      <div className="relative min-w-[64px] h-full flex flex-col justify-between border-r border-border bg-muted/10 pt-8 pb-4 shrink-0">
        {/* Gradient overlay: fades the top 1/7 of the border from background → transparent */}
        <div
          className="absolute right-0 top-0 h-[14.2857%] w-2 -translate-x-[3px] pointer-events-none z-10 bg-gradient-to-b from-background to-transparent"
          aria-hidden="true"
        />

        {/* Scrollable workspace avatar list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col items-center gap-2 px-2 pt-3 pb-3">
            {workspaces.map((w) => (
              <WorkspaceAvatar
                key={w.id}
                workspace={w}
                isActive={w.id === activeWorkspaceId}
                onSwitch={handleSwitchWorkspace}
              />
            ))}

            {/* Add workspace button */}
            <button
              type="button"
              onClick={handleOpenWorkspace}
              title="Open workspace…"
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground border border-dashed border-muted-foreground/40 transition-transform duration-150 ease-out hover:scale-105 hover:border-muted-foreground/70 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 shrink-0"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </ScrollArea>

        {/* Bottom icons */}
        <div className="flex flex-col items-center gap-4 pt-2 border-t border-border/40 mt-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Global search"
            onClick={() => setGlobalSearchOpen(true)}
            className="rounded-full h-9 w-9"
          >
            <Search className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            onClick={() => router.navigate({ to: '/settings/api-keys' })}
            className="rounded-full h-9 w-9"
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main area — fully responsive conversation list */}
      <div className="flex-1 min-w-0 h-full flex flex-col">
        {/* Header: New chat + search + profile filter + sort + editor */}
        <div className="px-3 py-3 border-b border-border shrink-0">
          <Button
            className="w-full mb-2"
            size="sm"
            onClick={handleNewChat}
            disabled={
              createConversation.isPending ||
              !defaultProfile ||
              !activeWorkspace
            }
          >
            <Plus className="size-4 mr-1.5" />
            New Chat
          </Button>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Search — takes all remaining space, wraps to full width if needed */}
            <div className="relative min-w-[120px] flex-1 basis-full">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search…"
                value={leftSearch}
                onChange={(e) => setLeftSearch(e.target.value)}
                className="pl-7 h-7 text-sm w-full"
              />
            </div>

            {/* Profile select — sizes to content, never truncates */}
            <Select
              value={profileId ?? 'all'}
              onValueChange={(val) => setProfileId(val === 'all' ? null : val)}
            >
              <SelectTrigger className="h-7 text-sm shrink-0">
                <SelectValue placeholder="Profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All profiles</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* F04: Sort toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              title={`Sort by: ${conversationSort === 'updated' ? 'last updated' : 'created date'} (click to toggle)`}
              onClick={handleToggleSort}
            >
              <ArrowUpDown className="size-3.5" />
            </Button>

            {/* F08: Open in editor */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              title="Open in editor"
              onClick={handleOpenInEditor}
              disabled={!activeWorkspace}
            >
              <Code2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1 min-h-0 [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!min-w-0">
          <div className="px-1.5 py-1.5 space-y-0.5">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : !activeWorkspace ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-10 px-3 text-center"
              >
                <div className="w-24 h-24 mb-3 rounded-full bg-muted flex items-center justify-center">
                  <FolderOpen className="size-10 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold mb-1">
                  No workspace selected
                </h3>
                <p className="text-xs text-muted-foreground w-full mb-3">
                  Open a workspace to see your conversations.
                </p>
                <Button size="sm" onClick={handleOpenWorkspace}>
                  <FolderOpen className="size-3.5 mr-1.5" />
                  Open workspace
                </Button>
              </motion.div>
            ) : filtered.length === 0 ? (
              leftSearch ? (
                <p className="text-center text-xs text-muted-foreground py-8 px-3 w-full">
                  No matches
                </p>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-10 px-3 text-center"
                >
                  <div className="w-36 h-36 mb-3 overflow-hidden rounded-2xl opacity-70">
                    <EmptyStateAnimation
                      alt={`No conversations in ${activeWorkspace.name}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-sm font-semibold mb-1 truncate w-full">
                    No conversations in &ldquo;{activeWorkspace.name}&rdquo;
                  </h3>
                  <p className="text-xs text-muted-foreground w-full mb-3">
                    Start a new conversation to begin chatting.
                  </p>
                  <Button size="sm" onClick={handleNewChat}>
                    <Plus className="size-3.5 mr-1.5" />
                    New Chat
                  </Button>
                </motion.div>
              )
            ) : (
              <AnimatePresence
                mode="popLayout"
                onExitComplete={handleDeleteComplete}
              >
                {/* Pinned section */}
                {pinnedConversations.length > 0 && (
                  <Collapsible.Root defaultOpen>
                    <Collapsible.Trigger className="flex items-center justify-between w-full px-2 py-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground transition-colors group">
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-primary" />
                        Pinned
                      </span>
                      <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-0 group-data-[state=closed]:-rotate-90" />
                    </Collapsible.Trigger>
                    <Collapsible.Content className="space-y-0.5">
                      {pinnedConversations.map((c) => (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, transition: { duration: 0.15 } }}
                          transition={{ duration: 0.2 }}
                        >
                          <ConversationItem
                            conversation={c}
                            isActive={pathname === `/conversations/${c.id}`}
                            isDeleting={c.id === deletingId}
                            onDeleteStart={handleDeleteStart}
                            onClick={() =>
                              router.navigate({
                                to: '/conversations/$conversationId',
                                params: { conversationId: c.id }
                              })
                            }
                            workspaceName={activeWorkspace.name}
                            profileName={c.profile_name}
                            profileDeleted={c.profile_deleted}
                            showProfileBadge={profileId === null}
                          />
                        </motion.div>
                      ))}
                    </Collapsible.Content>
                  </Collapsible.Root>
                )}

                {/* Folders section */}
                {folders.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="text-xs font-semibold uppercase text-muted-foreground">
                        Folders
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setShowNewFolderInput(true)}
                        title="New folder"
                      >
                        <FolderPlus className="size-3.5" />
                      </Button>
                    </div>

                    {showNewFolderInput && (
                      <div className="px-2 py-1 flex gap-1">
                        <Input
                          placeholder="Folder name"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          className="h-7 text-xs min-w-0 flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateFolder()
                            if (e.key === 'Escape') setShowNewFolderInput(false)
                          }}
                        />
                        <Button
                          size="xs"
                          onClick={handleCreateFolder}
                          className="shrink-0"
                        >
                          Create
                        </Button>
                      </div>
                    )}

                    {folders.map((folder) => {
                      const folderConvs =
                        conversationsByFolder.get(folder.id) ?? []
                      if (folderConvs.length === 0) return null
                      return (
                        <Collapsible.Root key={folder.id} defaultOpen>
                          <Collapsible.Trigger className="group flex items-center justify-between w-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Folder className="size-3.5 shrink-0" />
                              <span className="truncate">{folder.name}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                ({folderConvs.length})
                              </span>
                            </div>
                            <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-0 group-data-[state=closed]:-rotate-90 shrink-0" />
                          </Collapsible.Trigger>
                          <Collapsible.Content className="space-y-0.5 pl-5">
                            {folderConvs.map((c) => (
                              <motion.div
                                key={c.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{
                                  opacity: 0,
                                  transition: { duration: 0.15 }
                                }}
                                transition={{ duration: 0.2 }}
                              >
                                <ConversationItem
                                  conversation={c}
                                  isActive={
                                    pathname === `/conversations/${c.id}`
                                  }
                                  isDeleting={c.id === deletingId}
                                  onDeleteStart={handleDeleteStart}
                                  onClick={() =>
                                    router.navigate({
                                      to: '/conversations/$conversationId',
                                      params: { conversationId: c.id }
                                    })
                                  }
                                  workspaceName={activeWorkspace.name}
                                  profileName={c.profile_name}
                                  profileDeleted={c.profile_deleted}
                                  showProfileBadge={profileId === null}
                                />
                              </motion.div>
                            ))}
                          </Collapsible.Content>
                        </Collapsible.Root>
                      )
                    })}
                  </div>
                )}

                {/* Dated groups (folderless conversations) */}
                {Object.entries(groupedByDate).map(([key, convs]) => (
                  <Collapsible.Root
                    key={key}
                    open={!expandedDateGroups.includes(key)}
                    onOpenChange={() => toggleDateGroup(key)}
                  >
                    <Collapsible.Trigger className="flex items-center justify-between w-full px-2 py-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground transition-colors group mt-2 first:mt-0">
                      {key}
                      <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-0 group-data-[state=closed]:-rotate-90 shrink-0" />
                    </Collapsible.Trigger>
                    <Collapsible.Content className="space-y-0.5">
                      {convs.map((c) => (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, transition: { duration: 0.15 } }}
                          transition={{ duration: 0.2 }}
                        >
                          <ConversationItem
                            conversation={c}
                            isActive={pathname === `/conversations/${c.id}`}
                            isDeleting={c.id === deletingId}
                            onDeleteStart={handleDeleteStart}
                            onClick={() =>
                              router.navigate({
                                to: '/conversations/$conversationId',
                                params: { conversationId: c.id }
                              })
                            }
                            workspaceName={activeWorkspace.name}
                            profileName={c.profile_name}
                            profileDeleted={c.profile_deleted}
                            showProfileBadge={profileId === null}
                          />
                        </motion.div>
                      ))}
                    </Collapsible.Content>
                  </Collapsible.Root>
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
