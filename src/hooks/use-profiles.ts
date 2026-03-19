/**
 * Profile data hooks.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import type { UUID } from '@/lib/types'

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const res = await commands.listProfiles()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 60_000
  })
}

export function useCreateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      modelProvider,
      modelId
    }: {
      name: string
      modelProvider: string
      modelId: string
    }) => {
      const res = await commands.createProfile(name, modelProvider, modelId)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] })
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      name,
      model_provider,
      model_id,
      system_prompt,
    }: {
      id: UUID
      name?: string
      model_provider?: string
      model_id?: string
      system_prompt?: string
    }) => {
      const res = await commands.updateProfile(
        id,
        name ?? null,
        model_provider ?? null,
        model_id ?? null,
        system_prompt ?? null
      )
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}

export function useDeleteProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: UUID) => {
      const res = await commands.deleteProfile(id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] })
  })
}
