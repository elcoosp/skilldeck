import { useSettingsStore } from '@/store/settings'
import { cn } from '@/lib/utils'

export function AppearanceTab() {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold mb-0.5">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Choose your preferred theme.
        </p>
      </div>

      <div className="flex gap-2">
        {(['light', 'dark', 'system'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            className={cn(
              'flex-1 py-2 rounded-md border text-sm font-medium capitalize transition-colors',
              theme === t
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
