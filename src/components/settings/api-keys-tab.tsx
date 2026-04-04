import { useQuery } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SettingsSection } from '@/components/settings/settings-section'
import { commands } from '@/lib/bindings'
import { cn } from '@/lib/utils'

const PROVIDERS = [
  { id: 'claude', label: 'Anthropic (Claude)', placeholder: 'sk-ant-…' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-…' },
  { id: 'ollama', label: 'Ollama (local)', placeholder: 'optional token' }
]

export function ApiKeysTab() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const { data: keyStatuses = [], refetch } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const res = await commands.listApiKeys()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    }
  })

  const handleSave = async (provider: string) => {
    const key = values[provider]?.trim()
    if (!key) return

    const validRes = await commands.validateApiKey(provider, key)
    if (validRes.status === 'error' || !validRes.data) {
      toast.error(`Invalid format for ${provider} key`)
      return
    }

    setSaving((s) => ({ ...s, [provider]: true }))
    try {
      const res = await commands.setApiKey(provider, key)
      if (res.status === 'error') throw new Error(res.error)
      setValues((v) => ({ ...v, [provider]: '' }))
      refetch()
      toast.success(`${provider} key saved`)
    } catch (err) {
      toast.error(`Failed to save key: ${err}`)
    } finally {
      setSaving((s) => ({ ...s, [provider]: false }))
    }
  }

  const handleDelete = async (provider: string) => {
    try {
      const res = await commands.deleteApiKey(provider)
      if (res.status === 'error') throw new Error(res.error)
      refetch()
      toast.success(`${provider} key removed`)
    } catch (err) {
      toast.error(`Failed to remove key: ${err}`)
    }
  }

  return (
    <div className="divide-y divide-border">
      <SettingsSection title="API Keys" description="Keys are stored exclusively in the OS keychain — never in the database.">
        <div className="space-y-4">
          {PROVIDERS.map(({ id, label, placeholder }) => {
            const status = keyStatuses.find((k: any) => k.provider === id)
            const hasKey = status?.has_key ?? false

            return (
              <div key={id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{label}</span>
                  {hasKey && (
                    <Badge
                      variant="outline"
                      className="bg-primary/10 text-primary border-primary/20"
                    >
                      Key stored
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={visible[id] ? 'text' : 'password'}
                      value={values[id] ?? ''}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [id]: e.target.value }))
                      }
                      placeholder={hasKey ? '••••••••••••• (replace)' : placeholder}
                      className={cn(
                        'w-full h-8 rounded-md border border-input bg-background px-3 pr-9 text-sm',
                        'placeholder:text-muted-foreground focus-visible:outline-none',
                        'focus-visible:ring-2 focus-visible:ring-ring/50'
                      )}
                      onKeyDown={(e) => e.key === 'Enter' && handleSave(id)}
                    />
                    <button
                      type="button"
                      onClick={() => setVisible((v) => ({ ...v, [id]: !v[id] }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {visible[id] ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </button>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleSave(id)}
                    disabled={!values[id]?.trim() || saving[id]}
                  >
                    {saving[id] ? '…' : 'Save'}
                  </Button>

                  {hasKey && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </SettingsSection>
    </div>
  )
}
