// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import {
  useCreateFolder,
  useDeleteFolder,
  useFolders,
  useMoveConversationToFolder,
  useRenameFolder
} from '@/hooks/use-folders'

const commands = vi.hoisted(() => ({
  listFolders: vi.fn(),
  createFolder: vi.fn(),
  renameFolder: vi.fn(),
  deleteFolder: vi.fn(),
  moveConversationToFolder: vi.fn()
}) as Record<string, ReturnType<typeof vi.fn>>)
vi.mock('@/lib/bindings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bindings')>()
  return { ...actual, commands: { ...actual.commands, ...commands } }
})

afterEach(cleanup)

const folder = { id: 'f1', name: 'Work', conversation_ids: [] }

describe('useFolders', () => {
  it('returns the folder list on success', async () => {
    commands.listFolders.mockResolvedValue({ status: 'ok', data: [folder] })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useFolders(), { wrapper: wrapper(client) })
    await waitFor(() => expect(result.current.data).toEqual([folder]))
  })

  it('surfaces the command error', async () => {
    commands.listFolders.mockResolvedValue({ status: 'error', error: 'boom' })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useFolders(), { wrapper: wrapper(client) })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCreateFolder', () => {
  it('creates a folder and invalidates the list', async () => {
    commands.createFolder.mockResolvedValue({ status: 'ok', data: folder })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCreateFolder(), {
      wrapper: wrapper(client)
    })
    result.current.mutate('Work')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.createFolder).toHaveBeenCalledWith('Work')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['folders'] })
  })
})

describe('useRenameFolder', () => {
  it('renames a folder and invalidates the list', async () => {
    commands.renameFolder.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useRenameFolder(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ id: 'f1', name: 'NewName' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.renameFolder).toHaveBeenCalledWith('f1', 'NewName')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['folders'] })
  })
})

describe('useDeleteFolder', () => {
  it('deletes a folder and invalidates the list', async () => {
    commands.deleteFolder.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteFolder(), {
      wrapper: wrapper(client)
    })
    result.current.mutate('f1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.deleteFolder).toHaveBeenCalledWith('f1')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['folders'] })
  })
})

describe('useMoveConversationToFolder', () => {
  it('moves a conversation and invalidates conversations', async () => {
    commands.moveConversationToFolder.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useMoveConversationToFolder(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ conversationId: 'c1', folderId: 'f1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.moveConversationToFolder).toHaveBeenCalledWith('c1', 'f1')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations'] })
  })

  it('clears a folder assignment when folderId is null', async () => {
    commands.moveConversationToFolder.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useMoveConversationToFolder(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ conversationId: 'c1', folderId: null })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.moveConversationToFolder).toHaveBeenCalledWith('c1', null)
  })
})