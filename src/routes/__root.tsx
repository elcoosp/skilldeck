import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { HotkeysProvider } from 'react-hotkeys-hook'
import { z } from 'zod'

export const rootSearchSchema = z.object({
  leftSearch: z.string().optional(),
  profileId: z.string().optional(),
  expandedFolders: z.string().optional(),
  expandedDateGroups: z.string().optional(),
  onboard: z.enum(['true']).optional()
})

export type RootSearch = z.infer<typeof rootSearchSchema>

export const Route = createRootRoute({
  validateSearch: rootSearchSchema,
  component: RootComponent,
  notFoundComponent: NotFound
})

function RootComponent() {
  return (
    <HotkeysProvider initiallyActiveScopes={['*']}>
      <Outlet />
      {/*{import.meta.env.DEV && <TanStackRouterDevtools />}*/}
    </HotkeysProvider>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-background">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="text-muted-foreground mb-4">Page not found</p>
      <button
        type="button"
        onClick={() => (window.location.href = '/')}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        Go to Home
      </button>
    </div>
  )
}
