import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  scrollToTopSelectors: ['#message-thread-scroll-container'],
  scrollRestorationBehavior: 'smooth' // or 'instant' for immediate jump
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
