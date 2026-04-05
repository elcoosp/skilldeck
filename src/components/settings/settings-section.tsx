// src/components/settings/settings-section.tsx
import type { ReactNode } from 'react'

interface SettingsSectionProps {
  title: string
  description?: string
  children: ReactNode
}

export function SettingsSection({
  title,
  description,
  children
}: SettingsSectionProps) {
  return (
    <section className="px-5 py-4">
      <div className="mb-1">
        <h3 className="text-sm font-medium leading-none">{title}</h3>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}
