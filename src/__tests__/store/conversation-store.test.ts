import { beforeEach, describe, expect, it } from 'vitest'
import { useConversationStore } from '@/store/conversation'

const initialState = useConversationStore.getState()

beforeEach(() => {
  useConversationStore.setState(initialState, true)
})

describe('useConversationStore', () => {
  it('defaults to null ids', () => {
    const s = useConversationStore.getState()
    expect(s.activeConversationId).toBeNull()
    expect(s.activeBranchId).toBeNull()
    expect(s.scrollToMessageId).toBeNull()
  })

  it('setActiveConversation updates the id', () => {
    useConversationStore.getState().setActiveConversation('conv-1')
    expect(useConversationStore.getState().activeConversationId).toBe('conv-1')
  })

  it('setActiveConversation accepts null', () => {
    useConversationStore.getState().setActiveConversation('conv-1')
    useConversationStore.getState().setActiveConversation(null)
    expect(useConversationStore.getState().activeConversationId).toBeNull()
  })

  it('setActiveBranch updates the branch id', () => {
    useConversationStore.getState().setActiveBranch('branch-9')
    expect(useConversationStore.getState().activeBranchId).toBe('branch-9')
  })

  it('setScrollToMessageId updates then can clear', () => {
    useConversationStore.getState().setScrollToMessageId('msg-5')
    expect(useConversationStore.getState().scrollToMessageId).toBe('msg-5')
    useConversationStore.getState().setScrollToMessageId(null)
    expect(useConversationStore.getState().scrollToMessageId).toBeNull()
  })
})