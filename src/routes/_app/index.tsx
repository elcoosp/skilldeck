// src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/')({
  component: () => {
    // Redirect to a default conversation or just show empty center panel
    // For now, return null to let AppShell handle everything
    return null
  }
})
