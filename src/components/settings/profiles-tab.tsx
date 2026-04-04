import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Plus, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  useDeleteProfile,
  useProfiles,
  useRestoreProfile,
  useSetDefaultProfile
} from '@/hooks/use-profiles'
import { commands } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'

const PROVIDER_OPTIONS = [
  { id: 'ollama', label: 'Ollama (local)' },
  { id: 'claude', label: 'Anthropic (Claude)' },
  { id: 'openai', label: 'OpenAI' }
]

function useAvailableModels(provider: string) {
  return useQuery({
    queryKey: ['available-models', provider],
    queryFn: async () => {
      if (provider === 'ollama') {
        const res = await commands.listOllamaModels()
        if (res.status === 'ok') return res.data.map((m) => m.id)
        return []
      }
      if (provider === 'claude') {
        return ['claude-sonnet-4-5', 'claude-opus-4', 'claude-3-5-sonnet']
      }
      if (provider === 'openai') {
        return ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo']
      }
      return []
    },
    staleTime: 60_000
  })
}

export function ProfilesTab() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newProvider, setNewProvider] = useState('ollama')
  const [newModel, setNewModel] = useState('')
  const [newSystemPrompt, setNewSystemPrompt] = useState('')

  // State for inline system prompt editor
  const [expandedProfileId, setExpandedProfileId] = useState<string | null>(null)
  const [editSystemPrompt, setEditSystemPrompt] = useState('')

  const { data: allProfiles = [], isLoading } = useProfiles(true)
  const activeProfiles = allProfiles.filter((p) => !p.deleted_at)
  const deletedProfiles = allProfiles.filter((p) => p.deleted_at)

  const { data: models = [], isLoading: modelsLoading } =
    useAvailableModels(newProvider)

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await commands.createProfile(
        newName.trim(),
        newProvider,
        newModel.trim() || (models[0] ?? ''),
        newSystemPrompt.trim() || null
      )
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Profile created')
      setShowNew(false)
      setNewName('')
      setNewModel('')
      setNewProvider('ollama')
      setNewSystemPrompt('')
    },
    onError: (e: unknown) => toast.error(String(e))
  })

  const deleteMut = useDeleteProfile()
  const defaultMut = useSetDefaultProfile()
  const restoreMut = useRestoreProfile()
  const updateProfile = useUpdateProfile()

  function getProviderName(provider: string | { id: string; name: string }) {
    if (typeof provider === 'string') {
      const found = PROVIDER_OPTIONS.find((p) => p.id === provider)
      return found ? found.label : provider
    }
    return provider.name || provider.id
  }

  // Get updateProfile mutation (already defined in hook)
  // Note: useUpdateProfile is imported but not defined above; we need to import it.
  // Add to imports: import { useUpdateProfile } from '@/hooks/use-profiles';
  // The hook exists in use-profiles.ts, so we add it.

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold mb-0.5">Profiles</h2>
          <p className="text-sm text-muted-foreground">
            Each profile pairs a name with a model provider and ID, and can
            include a system prompt.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowNew((v) => !v)}>
          <Plus className="size-3 mr-1" />
          New
        </Button>
      </div>

      {showNew && (
        <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
          <input
            placeholder="Profile name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full h-7 rounded-md border border-input bg-background px-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <select
            value={newProvider}
            onChange={(e) => {
              setNewProvider(e.target.value)
              setNewModel('')
            }}
            className="w-full h-7 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {PROVIDER_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {newProvider === 'ollama' ? (
            <select
              value={newModel || (models[0] ?? '')}
              onChange={(e) => setNewModel(e.target.value)}
              className="w-full h-7 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              disabled={modelsLoading}
            >
              {models.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          ) : (
            <input
              placeholder={`Model ID (e.g. ${models[0] ?? 'claude-sonnet-4-5'})`}
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              className="w-full h-7 rounded-md border border-input bg-background px-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          )}

          <textarea
            placeholder="System prompt (optional)"
            value={newSystemPrompt}
            onChange={(e) => setNewSystemPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 resize-y"
          />

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => createMut.mutate()}
              disabled={!newName.trim() || createMut.isPending}
            >
              {createMut.isPending ? 'Creating…' : 'Create'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowNew(false)
                setNewName('')
                setNewModel('')
                setNewProvider('ollama')
                setNewSystemPrompt('')
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <div className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : activeProfiles.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No profiles yet.</p>
      ) : (
        <div className="space-y-2">
          {activeProfiles.map((p: any) => (
            <div
              key={p.id}
              className={cn(
                'rounded-lg border px-3 py-2.5',
                p.is_default
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{p.name}</span>
                    {p.is_default && (
                      <Badge
                        variant="outline"
                        className="bg-primary/10 text-primary border-primary/20"
                      >
                        default
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {getProviderName(p.model_provider)} · {p.model_id}
                  </p>
                  {p.system_prompt && (
                    <p className="text-xs text-muted-foreground/70 truncate mt-0.5 italic">
                      {p.system_prompt}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => {
                      if (expandedProfileId === p.id) {
                        setExpandedProfileId(null)
                      } else {
                        setEditSystemPrompt(p.system_prompt ?? '')
                        setExpandedProfileId(p.id)
                      }
                    }}
                    title="Edit personality"
                  >
                    {expandedProfileId === p.id ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </Button>
                  {!p.is_default && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => defaultMut.mutate(p.id)}
                      disabled={defaultMut.isPending}
                      title="Set as default"
                    >
                      <Star className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => deleteMut.mutate(p.id)}
                    disabled={deleteMut.isPending}
                    title="Delete profile"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Inline system prompt editor */}
              {expandedProfileId === p.id && (
                <div className="mt-3 border-t pt-3">
                  <label className="text-sm font-medium">Personality / System Prompt</label>
                  <Textarea
                    className="mt-1.5 min-h-[100px]"
                    placeholder="You are a helpful assistant with a concise, direct style..."
                    value={editSystemPrompt}
                    onChange={(e) => setEditSystemPrompt(e.target.value)}
                    maxLength={4000}
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {editSystemPrompt.length} / 4000
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedProfileId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          updateProfile.mutate({
                            id: p.id,
                            system_prompt: editSystemPrompt
                          })
                          setExpandedProfileId(null)
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {deletedProfiles.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <h3 className="text-sm font-medium mb-2">Deleted Profiles</h3>
          <p className="text-xs text-muted-foreground mb-3">
            These profiles are hidden from the list. Restore them to make
            conversations reappear.
          </p>
          <div className="space-y-2">
            {deletedProfiles.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2 rounded border border-border"
              >
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Deleted</p>
                </div>
                <Button
                  size="xs"
                  onClick={() => restoreMut.mutate(p.id)}
                  disabled={restoreMut.isPending}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
