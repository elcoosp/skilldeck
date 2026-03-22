// src/store/bookmarks.ts
import { create } from 'zustand'
import { commands, type BookmarkData } from '@/lib/bindings'
import { toast } from 'sonner'

interface BookmarksState {
  bookmarks: Record<string, BookmarkData[]> // keyed by conversationId
  isLoading: Record<string, boolean>
  loadBookmarks: (conversationId: string) => Promise<void>
  addBookmark: (conversationId: string, data: BookmarkData) => void
  removeBookmark: (conversationId: string, bookmarkId: string) => void
  toggleBookmark: (conversationId: string, messageId: string, headingAnchor?: string, label?: string) => Promise<BookmarkData | null>
  getBookmarksForMessage: (conversationId: string, messageId: string) => BookmarkData[]
}

export const useBookmarksStore = create<BookmarksState>((set, get) => ({
  bookmarks: {},
  isLoading: {},
  loadBookmarks: async (conversationId) => {
    set((state) => ({ isLoading: { ...state.isLoading, [conversationId]: true } }))
    try {
      const data = await commands.listBookmarks(conversationId)
      const bookmarksArray = Array.isArray(data) ? data : []
      set((state) => ({
        bookmarks: { ...state.bookmarks, [conversationId]: bookmarksArray },
      }))
    } catch (e) {
      console.error('Failed to load bookmarks', e)
      toast.error('Could not load bookmarks')
    } finally {
      set((state) => ({ isLoading: { ...state.isLoading, [conversationId]: false } }))
    }
  },
  addBookmark: (conversationId, data) => {
    set((state) => {
      const current = state.bookmarks[conversationId] ?? []
      // Avoid duplicates – replace if already exists
      const filtered = current.filter(
        b => !(b.message_id === data.message_id && b.heading_anchor === data.heading_anchor)
      )
      const newArray = [...filtered, data]
      return {
        bookmarks: { ...state.bookmarks, [conversationId]: newArray },
      }
    })
  },
  removeBookmark: (conversationId, bookmarkId) => {
    set((state) => {
      const current = state.bookmarks[conversationId]
      if (!Array.isArray(current)) return state
      const filtered = current.filter((b) => b.id !== bookmarkId)
      return {
        bookmarks: { ...state.bookmarks, [conversationId]: filtered },
      }
    })
  },
  toggleBookmark: async (conversationId, messageId, headingAnchor, label) => {
    // 1. Find existing bookmark for this (message, heading) combination
    const current = get().bookmarks[conversationId] ?? []
    const existing = current.find(
      b => b.message_id === messageId && b.heading_anchor === (headingAnchor ?? null)
    )

    // 2. Optimistic update: remove if exists, otherwise we'll add after response
    if (existing) {
      get().removeBookmark(conversationId, existing.id)
    } else {
      // For add, we don't have the server-generated ID yet, so we can't add optimistically.
      // We'll wait for the response. But we can show a pending state if desired.
      // For now, we don't add optimistically to avoid ID mismatches.
    }

    try {
      const result = await commands.toggleBookmark(conversationId, messageId, headingAnchor ?? null, label ?? null)

      if (result) {
        // Bookmark was added – store the server-returned data
        get().addBookmark(conversationId, result)
        return result
      } else {
        // Bookmark was removed – optimistic removal already done, so nothing else to do.
        // If there was no optimistic removal (i.e., we didn't remove because we didn't have it),
        // we still need to ensure it's removed. But the server says it's removed, so we should
        // remove it anyway. However, our optimistic removal already covered the case where it existed.
        // If it didn't exist, then there's nothing to remove.
        return null
      }
    } catch (error) {
      console.error('Failed to toggle bookmark', error)
      // Revert optimistic removal if the call failed
      if (existing) {
        // Put it back
        get().addBookmark(conversationId, existing)
      }
      toast.error('Failed to update bookmark')
      return null
    }
  },
  getBookmarksForMessage: (conversationId, messageId) => {
    const convBookmarks = get().bookmarks[conversationId] ?? []
    return convBookmarks.filter(b => b.message_id === messageId)
  },
}))
