import { useQuery } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'

export function useArtifactContent(artifactId: string | null) {
  return useQuery({
    queryKey: ['artifact', artifactId],
    queryFn: async () => {
      if (!artifactId) throw new Error('No artifact ID')
      const res = await commands.getArtifactContent(artifactId)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    enabled: !!artifactId,
    staleTime: Infinity // artifacts are immutable
  })
}
