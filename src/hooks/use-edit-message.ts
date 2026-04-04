// src/hooks/use-edit-message.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import type { UUID } from '@/lib/types'

export function useEditMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ messageId, newContent }: { messageId: string; newContent: string }) => {
      // This command needs to be implemented in Rust backend
      // For now, we return a placeholder success
      console.log('Edit message', messageId, newContent)
      // return invoke('edit_message', { messageId, newContent })
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
    }
  })
}
