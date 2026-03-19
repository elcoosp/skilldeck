import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { onSkillEvent } from '@/lib/events'

export function useSkillEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let unlisten: (() => void) | null = null

    onSkillEvent(() => {
      // Any skill change → refetch the local skills list (which now includes lint results)
      queryClient.invalidateQueries({ queryKey: ['local_skills'] })
    }).then((fn) => { unlisten = fn })

    return () => { unlisten?.() }
  }, [queryClient])
}
