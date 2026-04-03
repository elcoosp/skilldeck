// src/components/layout/center-panel.tsx
import { Outlet } from '@tanstack/react-router'

export function CenterPanel() {
  return (
    <div className="relative flex flex-col h-full">
      <Outlet />
    </div>
  )
}
