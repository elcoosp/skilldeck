// src/routes/_app/settings.shortcuts.tsx
import { createFileRoute } from '@tanstack/react-router'
import { ShortcutsTab } from '@/components/settings/shortcuts-tab'

export const Route = createFileRoute('/_app/settings/shortcuts')({
  component: ShortcutsTab,
})
