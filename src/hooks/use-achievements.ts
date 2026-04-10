import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ACHIEVEMENTS, type AchievementId } from '@/lib/achievements'
import { commands } from '@/lib/bindings'

const STORAGE_KEY = 'skilldeck-achievements'

async function migrateFromLocalStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return
    const ids: string[] = JSON.parse(stored)
    for (const id of ids) {
      await commands.unlockAchievement(id)
    }
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore migration errors
  }
}

export function useAchievements() {
  const queryClient = useQueryClient()

  const { data: unlockedIds = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      await migrateFromLocalStorage()
      const res = await commands.listAchievements()
      if (res.status === 'ok') return res.data.map((a) => a.id)
      return []
    },
    staleTime: Infinity,
  })

  const unlockMutation = useMutation({
    mutationFn: async (id: AchievementId) => {
      const res = await commands.unlockAchievement(id)
      if (res.status === 'error') throw new Error(res.error)
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['achievements'], (old: string[] = []) => [...old, id])
      const ach = ACHIEVEMENTS[id]
      toast.success(`${ach.emoji} Achievement Unlocked: ${ach.title}`, {
        description: ach.description,
        duration: 4000,
      })
    },
  })

  const unlock = useCallback(
    (id: AchievementId) => {
      if (!unlockedIds.includes(id) && !unlockMutation.isPending) {
        unlockMutation.mutate(id)
      }
    },
    [unlockedIds, unlockMutation]
  )

  const isUnlocked = useCallback(
    (id: AchievementId): boolean => {
      return unlockedIds.includes(id)
    },
    [unlockedIds]
  )

  return { unlock, isUnlocked }
}
