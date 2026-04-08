import type { ReactNode } from 'react'

export function SectionHeading({
  title,
  description,
  className
}: {
  title: ReactNode
  description?: string
  className?: string
}) {
  return (
    <div className={`text-center max-w-3xl mx-auto ${className ?? ''}`}>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          {description}
        </p>
      ) : null}
    </div>
  )
}
