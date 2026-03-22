import { create } from 'zustand'
import { commands, type BookmarkData } from '@/lib/bindings'
import { useUIStore } from './ui'

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
      set((state) => ({
        bookmarks: { ...state.bookmarks, [conversationId]: data },
      }))
    } catch (e) {
      console.error('Failed to load bookmarks', e)
    } finally {
      set((state) => ({ isLoading: { ...state.isLoading, [conversationId]: false } }))
    }
  },
  addBookmark: (conversationId, data) => {
    set((state) => ({
      bookmarks: {
        ...state.bookmarks,
        [conversationId]: [...(state.bookmarks[conversationId] || []), data],
      },
    }))
  },
  removeBookmark: (conversationId, bookmarkId) => {
    set((state) => ({
      bookmarks: {
        ...state.bookmarks,
        [conversationId]: (state.bookmarks[conversationId] || []).filter((b) => b.id !== bookmarkId),
      },
    }))
  },
  toggleBookmark: async (conversationId, messageId, headingAnchor, label) => {
    const result = await commands.toggleBookmark(conversationId, messageId, headingAnchor ?? null, label ?? null)
    if (result) {
      get().addBookmark(conversationId, result)
      return result
    } else {
      // Need to find which bookmark was removed
      const existing = get().bookmarks[conversationId]?.find(b => b.message_id === messageId && b.heading_anchor === headingAnchor)
      if (existing) get().removeBookmark(conversationId, existing.id)
      return null
    }
  },
  getBookmarksForMessage: (conversationId, messageId) => {
    return (get().bookmarks[conversationId] || []).filter(b => b.message_id === messageId)
  },
}))
