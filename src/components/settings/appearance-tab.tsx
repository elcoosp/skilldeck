import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settings'
import { SettingsSection } from '@/components/settings/settings-section'
import { Switch } from '@/components/ui/switch'

export function AppearanceTab() {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const fontSize = useSettingsStore((s) => s.uiFontSize)
  const setFontSize = useSettingsStore((s) => s.setUiFontSize)
  const audioEnabled = useSettingsStore((s) => s.audioEnabled)
  const setAudioEnabled = useSettingsStore((s) => s.setAudioEnabled)
  const audioVolume = useSettingsStore((s) => s.audioVolume)
  const setAudioVolume = useSettingsStore((s) => s.setAudioVolume)

  return (
    <div className="divide-y divide-border">
      <SettingsSection
        title="Theme"
        description="Choose your preferred color scheme"
      >
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
      </SettingsSection>

      <SettingsSection
        title="Font Size"
        description="Adjust the base text size across the app"
      >
        <div className="flex gap-1">
          {(['sm', 'md', 'lg'] as const).map((size) => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                fontSize === size
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Preview: This is how your text will look at the selected size.
        </p>
      </SettingsSection>

      <SettingsSection
        title="Sound Effects"
        description="Play sounds for chat actions"
      >
        <div className="flex items-center justify-between">
          <label htmlFor="audio-toggle" className="text-sm">
            Enable sounds
          </label>
          <Switch
            id="audio-toggle"
            checked={audioEnabled}
            onCheckedChange={(v) => setAudioEnabled(v)}
          />
        </div>
        {audioEnabled && (
          <div className="mt-3">
            <label className="text-sm text-muted-foreground">Volume</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={audioVolume}
              onChange={(e) => setAudioVolume(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </div>
        )}
      </SettingsSection>
    </div>
  )
}
