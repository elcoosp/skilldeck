// src/components/layout/left-panel.tsx
/**
 * Left panel — conversation list, search, new chat, workspace switcher,
 * and profile filter.
 */

import { open } from '@tauri-apps/plugin-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, FolderOpen, Plus, Search, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { ConversationItem } from '@/components/conversation/conversation-item'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useConversations,
  useCreateConversation
} from '@/hooks/use-conversations'
import { useProfiles } from '@/hooks/use-profiles'
import { useOpenWorkspace, useWorkspaces } from '@/hooks/use-workspaces'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'
import { WorkspaceContextBadge } from '@/components/workspace/workspace-context-badge' // <-- new import

// ... rest of the file (unchanged until the footer section)

{/* Footer with workspace switcher */ }
<div className="p-3 border-t border-border shrink-0 min-w-0 space-y-2">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-between"
      >
        <span className="truncate flex items-center">
          {activeWorkspace ? activeWorkspace.name : 'No workspace'}
          {activeWorkspace && <WorkspaceContextBadge workspace={activeWorkspace} />}
        </span>
        <ChevronDown className="size-3.5 opacity-50 shrink-0" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="start"
      className="w-[--radix-dropdown-menu-trigger-width]"
    >
      {workspaces.length === 0 ? (
        <DropdownMenuItem disabled>No workspaces yet</DropdownMenuItem>
      ) : (
        workspaces.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onClick={() => handleSwitchWorkspace(w)}
            className={cn(
              'flex items-center justify-between',
              w.id === activeWorkspaceId && 'bg-accent'
            )}
          >
            <span className="truncate">{w.name}</span>
            {!w.is_open && (
              <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                (closed)
              </span>
            )}
          </DropdownMenuItem>
        ))
      )}
    </DropdownMenuContent>
  </DropdownMenu>

  <Button
    variant="outline"
    size="sm"
    className="w-full"
    onClick={handleOpenWorkspace}
    title="Open another workspace"
  >
    <FolderOpen className="size-3.5 mr-1.5 shrink-0" />
    <span className="truncate">Open another workspace</span>
  </Button>
</div>
    </div >
  )
}
