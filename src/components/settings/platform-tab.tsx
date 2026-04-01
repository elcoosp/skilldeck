// src/components/settings/platform-tab.tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  isPlatformNotConfigured,
  usePlatformPreferences,
  usePlatformRegistration
} from '@/hooks/use-platform'
import { platformUrl } from '@/lib/config' // <-- import central URL

export function PlatformTab() {
  const { query, update } = usePlatformPreferences()
  const register = usePlatformRegistration()
  const prefs = query.data

  const [enabled, setEnabled] = useState(prefs?.platformEnabled ?? true)
  const [url, setUrl] = useState(
    prefs?.platformUrl ?? platformUrl('') // <-- use central URL
  )

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

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Loading platform preferences…
      </div>
    )
  }

  if (isPlatformNotConfigured(query)) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          SkillDeck Platform is not yet set up for this device.
        </p>
        <Button
          onClick={() => register.mutate()}
          disabled={register.isPending}
          size="sm"
        >
          {register.isPending ? 'Registering…' : 'Register with Platform'}
        </Button>
        {register.isError && (
          <div className="text-destructive text-xs mt-2">
            {register.error?.message.includes('Network')
              ? 'Network error – check your connection'
              : register.error?.message.includes('401')
                ? 'Invalid API key – check your platform token'
                : `Registration failed: ${register.error.message}`}
            <button
              type="button"
              onClick={() => register.mutate()}
              className="ml-2 underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="p-4 text-sm text-destructive">
        Could not load platform preferences.
      </div>
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
