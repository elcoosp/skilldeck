import { createFileRoute, redirect } from '@tanstack/react-router'
import { commands } from '@/lib/bindings'

export const Route = createFileRoute('/shared/$shareToken')({
  loader: async ({ params }) => {
    const { shareToken } = params

    // Fetch the shared conversation from platform
    const sharedRes = await commands.getSharedConversation(shareToken)
    if (sharedRes.status === 'error') {
      throw new Error(sharedRes.error)
    }

    // Hydrate locally (creates conversation and messages if not exist)
    const hydrateRes = await commands.hydrateSharedConversation(sharedRes.data)
    if (hydrateRes.status === 'error') {
      throw new Error(hydrateRes.error)
    }

    // Redirect to the conversation view
    throw redirect({
      to: '/conversations/$conversationId',
      params: { conversationId: hydrateRes.data.local_id }
    })
  },
  component: function SharedLoading() {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading shared conversation...</p>
        </div>
      </div>
    )
  }
})
