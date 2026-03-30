import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'

export function useBookmarks(conversationId: string | null) {
  return useQuery({
    queryKey: ['bookmarks', conversationId],
    queryFn: async () => {
      if (!conversationId) return []
      const res = await commands.listBookmarks(conversationId)
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    enabled: !!conversationId,
    staleTime: 10_000,
  })
}

export function useToggleBookmark(conversationId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      messageId,
      headingAnchor,
      label,
    }: {
      messageId: string
      headingAnchor?: string | null
      label?: string | null
    }) => {
      if (!conversationId) throw new Error('No conversation ID')
      const res = await commands.toggleBookmark(
        conversationId,
        messageId,
        headingAnchor ?? null,
        label ?? null,
      )
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['bookmarks', conversationId] })
      }
    },
  })
}
