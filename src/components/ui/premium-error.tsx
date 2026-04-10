// src/components/ui/premium-error.tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PremiumErrorProps {
  code?: number | string
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function PremiumError({
  code = '404',
  title = 'Page not found',
  description = "The page you're looking for doesn't exist or has been moved.",
  action,
  secondaryAction,
  className
}: PremiumErrorProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-[400px] w-full items-center justify-center p-8',
        className
      )}
    >
      {/* Subtle static gradient background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-background to-primary/10" />

      {/* Simple card with soft shadow and border */}
      <div className="relative max-w-md w-full">
        <Card className="overflow-hidden bg-background/95 backdrop-blur-sm border border-primary/20 shadow-xl rounded-xl">
          <CardContent className="p-8 text-center">
            {/* Error code - gradient text */}
            <div className="mb-4">
              <div className="text-7xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                {String(code)}
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-semibold mb-2">{title}</h2>

            {/* Description */}
            <p className="text-muted-foreground mb-6">{description}</p>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 justify-center">
              {action && (
                <Button onClick={action.onClick} size="default">
                  {action.label}
                </Button>
              )}
              {secondaryAction && (
                <Button variant="outline" onClick={secondaryAction.onClick}>
                  {secondaryAction.label}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
