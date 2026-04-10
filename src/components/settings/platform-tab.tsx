// src/components/settings/platform-tab.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PremiumError } from '@/components/ui/premium-error'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import {
  isPlatformNotConfigured,
  usePlatformPreferences,
  usePlatformRegistration
} from '@/hooks/use-platform'
import { platformUrl } from '@/lib/config'

export function PlatformTab() {
  const { query, update } = usePlatformPreferences()
  const register = usePlatformRegistration()
  const prefs = query.data

  const [enabled, setEnabled] = useState(prefs?.platformEnabled ?? true)
  const [url, setUrl] = useState(prefs?.platformUrl ?? platformUrl(''))

  const save = () => {
    update.mutate(
      { platformEnabled: enabled, platformUrl: url },
      {
        onSuccess: () => {
          toast.success('Platform settings saved')
        },
        onError: (error) => {
          toast.error(`Failed to save: ${error}`)
        }
      }
    )
  }

  // Loading – centered
  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground text-sm">
        Loading platform preferences…
      </div>
    )
  }

  // Not configured – show PremiumError with action
  if (isPlatformNotConfigured(query)) {
    return (
      <PremiumError
        code="🔌"
        title="Platform not configured"
        description="SkillDeck Platform is not yet set up for this device. Register to sync skills and receive updates."
        action={{
          label: register.isPending ? 'Registering…' : 'Register with Platform',
          onClick: () => register.mutate()
        }}
        secondaryAction={{
          label: 'Retry',
          onClick: () => query.refetch()
        }}
      />
    )
  }

  // Error – show PremiumError
  if (query.isError) {
    return (
      <PremiumError
        code="⚠️"
        title="Failed to load platform settings"
        description="Could not load platform preferences. Make sure you're connected and try again."
        action={{
          label: 'Retry',
          onClick: () => query.refetch()
        }}
        secondaryAction={{
          label: 'Go back',
          onClick: () => window.history.back()
        }}
      />
    )
  }

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h3 className="text-sm font-medium">Platform Sync</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Connect to SkillDeck Platform to browse and install community skills.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm" htmlFor="platform-enabled">
          Enable platform sync
        </label>
        <Switch
          id="platform-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm" htmlFor="platform-url">
          Platform URL
        </label>
        <Input
          id="platform-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={platformUrl('')}
        />
        <p className="text-xs text-muted-foreground">
          Change this only if you're using a self-hosted instance.
        </p>
      </div>

      <Button
        onClick={save}
        size="sm"
        disabled={update.isPending}
        className="w-full"
      >
        {update.isPending ? 'Saving…' : 'Save Settings'}
      </Button>
    </div>
  )
}
