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
      const result = await commands.listBookmarks(conversationId)
      if (result.status === 'ok') {
        const bookmarksArray = Array.isArray(result.data) ? result.data : []
        set((state) => ({
          bookmarks: { ...state.bookmarks, [conversationId]: bookmarksArray },
        }))
        console.log(`[loadBookmarks] loaded ${bookmarksArray.length} bookmarks for conv ${conversationId}`)
      } else {
        console.error('Failed to load bookmarks', result.error)
        toast.error('Could not load bookmarks')
      }
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
      console.log(`[addBookmark] added bookmark ${data.id} for conv ${conversationId}, now ${newArray.length} bookmarks`)
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
      console.log(`[removeBookmark] removed bookmark ${bookmarkId} from conv ${conversationId}, remaining ${filtered.length}`)
      return {
        bookmarks: { ...state.bookmarks, [conversationId]: filtered },
      }
    })
  },
  toggleBookmark: async (conversationId, messageId, headingAnchor, label) => {
    console.log(`[toggleBookmark] start: conv ${conversationId}, msg ${messageId}, anchor ${headingAnchor}, label ${label}`)
    // 1. Find existing bookmark for this (message, heading) combination
    const current = get().bookmarks[conversationId] ?? []
    const existing = current.find(
      b => b.message_id === messageId && b.heading_anchor === (headingAnchor ?? null)
    )
    console.log(`[toggleBookmark] existing bookmark:`, existing)

    // 2. Optimistic update: remove if exists, otherwise we'll add after response
    if (existing) {
      get().removeBookmark(conversationId, existing.id)
    } else {
      console.log(`[toggleBookmark] no existing, will wait for server response`)
    }

    try {
      // Ensure label is a string (for heading bookmarks, use the heading text; for messages, use "Message")
      const safeLabel = label ?? 'Message'
      const result = await commands.toggleBookmark(conversationId, messageId, headingAnchor ?? null, safeLabel)
      console.log(`[toggleBookmark] server result:`, result)

      if (result.status === 'ok' && result.data) {
        // Bookmark was added – store the server-returned data
        get().addBookmark(conversationId, result.data)
        return result.data
      } else if (result.status === 'ok' && !result.data) {
        // Bookmark was removed – optimistic removal already done
        console.log(`[toggleBookmark] server indicates removal, done`)
        return null
      } else {
        // Error response
        console.error(`[toggleBookmark] server error:`, result.error)
        // Revert optimistic removal if the call failed
        if (existing) {
          get().addBookmark(conversationId, existing)
        }
        toast.error('Failed to update bookmark')
        return null
      }
    } catch (error) {
      console.error('[toggleBookmark] failed', error)
      // Revert optimistic removal if the call failed
      if (existing) {
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
