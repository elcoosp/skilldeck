// src/hooks/use-profiles.ts
/**
 * Profile data hooks.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import type { UUID } from '@/lib/types'

export function useProfiles(includeDeleted?: boolean) {
  return useQuery({
    queryKey: ['profiles', includeDeleted],
    queryFn: async () => {
      const res = await commands.listProfiles(includeDeleted ?? false)
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 0, // FIX: set to 0 to avoid stale default profile
  })
}

export function useCreateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      modelProvider,
      modelId,
      systemPrompt
    }: {
      name: string
      modelProvider: string
      modelId: string
      systemPrompt?: string | null
    }) => {
      const res = await commands.createProfile(name, modelProvider, modelId, systemPrompt ?? null)
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

export function useSetDefaultProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: UUID) => {
      const res = await commands.setDefaultProfile(id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      // FIX: Force a refetch to ensure the new default is immediately reflected
      queryClient.invalidateQueries({
        queryKey: ['profiles'],
        refetchType: 'all',
      })
    },
  })
}

export function useRestoreProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: UUID) => {
      const res = await commands.restoreProfile(id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}
