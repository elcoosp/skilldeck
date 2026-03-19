/**
 * Conversation data hooks — TanStack Query wrappers over invoke layer.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { commands } from '@/lib/bindings'
import type { UUID } from '@/lib/types'
import { useUIStore } from '@/store/ui'
import { useProfiles } from './use-profiles'

export function useConversations(profileId?: UUID | null) { // <-- changed
  return useQuery({
    queryKey: ['conversations', profileId],
    queryFn: async () => {
      const res = await commands.listConversations(
        profileId ?? null,
        50
      )
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2
  })
}

export function useCreateConversation(profileId?: UUID) {
  const queryClient = useQueryClient()
  const setActiveConversation = useUIStore((s) => s.setActiveConversation)
  const activeWorkspaceId = useUIStore((s) => s.activeWorkspaceId)

  return useMutation({
    mutationFn: async ({ title }: { title?: string }) => {
      if (!profileId) throw new Error('No profile selected')
      const res = await commands.createConversation(
        profileId,
        title ?? null,
        activeWorkspaceId ?? null
      )
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: async (newId) => {
      queryClient.invalidateQueries({
        queryKey: ['conversations', profileId],
        exact: true
      })
      await queryClient.refetchQueries({
        queryKey: ['conversations', profileId],
        exact: true
      })
      await new Promise((resolve) => setTimeout(resolve, 50))
      setActiveConversation(newId)
      toast.success('Conversation created')
    },
    onError: (error) => {
      toast.error(`Failed to create conversation: ${error}`)
    }
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const setActiveConversation = useUIStore((s) => s.setActiveConversation)

  return useMutation({
    mutationFn: async (id: UUID) => {
      const res = await commands.deleteConversation(id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({
        queryKey: ['conversations'],
        exact: false
      })
      if (activeConversationId === deletedId) {
        setActiveConversation(null)
      }
      toast.success('Conversation deleted')
    },
    onError: (error) => {
      toast.error(`Failed to delete conversation: ${error}`)
    }
  })
}

export function useRenameConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, title }: { id: UUID; title: string }) => {
      const res = await commands.renameConversation(id, title)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['conversations'],
        exact: false
      })
      toast.success('Conversation renamed')
    },
    onError: (error) => {
      toast.error(`Failed to rename conversation: ${error}`)
    }
  })
}

/**
 * Auto-name conversation from the first user message.
 * Takes the first message content, trims it to 60 characters,
 * capitalizes the first letter, and renames the conversation.
 */
export function useAutoNameConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      firstMessage
    }: {
      id: UUID
      firstMessage: string
    }) => {
      const title = firstMessage.trim().slice(0, 60)
      const capitalized = title.charAt(0).toUpperCase() + title.slice(1)
      const res = await commands.renameConversation(id, capitalized)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['conversations'],
        exact: false
      })
    },
    onError: (error) => {
      console.error('Failed to auto-name conversation:', error)
    }
  })
}

export function usePinConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: UUID) => {
      const res = await commands.pinConversation(id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Conversation pinned')
    },
    onError: (error) => {
      toast.error(`Failed to pin conversation: ${error}`)
    }
  })
}

export function useUnpinConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: UUID) => {
      const res = await commands.unpinConversation(id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Conversation unpinned')
    },
    onError: (error) => {
      toast.error(`Failed to unpin conversation: ${error}`)
    }
  })
}

/**
 * Hook to get the workspace ID of the currently active conversation.
 * Uses the React Query cache to look up the conversation by ID.
 */
export function useActiveConversationWorkspaceId(): string | null {
  const queryClient = useQueryClient()
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const { data: profiles } = useProfiles()
  const defaultProfile = profiles?.find(p => p.is_default) ?? profiles?.[0]

  const conversations = queryClient.getQueryData<Array<{ id: string; workspace_id: string | null }>>([
    'conversations',
    defaultProfile?.id
  ])
  const conversation = conversations?.find((c) => c.id === activeConversationId)
  return conversation?.workspace_id ?? null
}
