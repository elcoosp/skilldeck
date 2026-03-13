/**
 * Skill data hooks.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSkills, toggleSkill } from '@/lib/invoke'

export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: listSkills,
    staleTime: 30_000
  })
}

export function useToggleSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      toggleSkill(name, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills'] })
  })
}
