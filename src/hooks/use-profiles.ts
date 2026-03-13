/**
 * Profile data hooks.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile
} from '@/lib/invoke'
import type { UUID } from '@/lib/types'

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    staleTime: 60_000
  })
}

export function useCreateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      name,
      modelProvider,
      modelId
    }: {
      name: string
      modelProvider: string
      modelId: string
    }) => createProfile(name, modelProvider, modelId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] })
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...updates
    }: {
      id: UUID
      name?: string
      model_provider?: string
      model_id?: string
    }) => updateProfile(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] })
  })
}

export function useDeleteProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: UUID) => deleteProfile(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] })
  })
}
