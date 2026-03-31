import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands, FolderData } from '@/lib/bindings'

export function useFolders() {
  return useQuery({
    queryKey: ['folders'],
    queryFn: async () => {
      const res = await commands.listFolders()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 60_000
  })
}

export function useCreateFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await commands.createFolder(name)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    }
  })
}

export function useRenameFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await commands.renameFolder(id, name)
      if (res.status === 'error') throw new Error(res.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    }
  })
}

export function useDeleteFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await commands.deleteFolder(id)
      if (res.status === 'error') throw new Error(res.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    }
  })
}

export function useMoveConversationToFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      conversationId,
      folderId
    }: {
      conversationId: string
      folderId: string | null
    }) => {
      const res = await commands.moveConversationToFolder(
        conversationId,
        folderId
      )
      if (res.status === 'error') throw new Error(res.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })
}
