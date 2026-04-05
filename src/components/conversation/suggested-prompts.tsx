// src/components/conversation/suggested-prompts.tsx
import { useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { suggestedPrompts } from '@/lib/suggested-prompts'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'

const categoryLabels: Record<string, string> = {
  coding: 'Coding',
  writing: 'Writing',
  analysis: 'Analysis',
  debugging: 'Debugging',
  planning: 'Planning',
  brainstorming: 'Brainstorming'
}

interface SuggestedPromptsProps {
  conversationId: string | null
  hasMessages: boolean
  onSelect: (prompt: string) => void
}

export function SuggestedPrompts({
  conversationId,
  hasMessages,
  onSelect
}: SuggestedPromptsProps) {
  const [exploreOpen, setExploreOpen] = useState(false)
  const dismissed =
    useUIEphemeralStore((s) => s.suggestedPromptsDismissed) ?? {}
  const setSuggestedPromptsDismissed = useUIEphemeralStore(
    (s) => s.setSuggestedPromptsDismissed
  )

  // Guard: if conversationId is null or hasMessages true or already dismissed, don't render
  if (!conversationId || hasMessages || dismissed[conversationId]) return null

  const handleDismiss = () => {
    setSuggestedPromptsDismissed(conversationId, true)
  }

  const quickPrompts = suggestedPrompts.slice(0, 6)

  return (
    <div className="relative rounded-lg border bg-muted/30 px-3 py-2 mx-3 mt-2">
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        <span>Try a prompt</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {quickPrompts.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.prompt)}
            className="rounded-full border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent hover:text-primary-foreground"
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setExploreOpen(true)}
          className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-primary-foreground"
        >
          Explore more...
        </button>
      </div>
      <Dialog open={exploreOpen} onOpenChange={setExploreOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Suggested Prompts</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-4 thin-scrollbar">
            {Object.entries(categoryLabels).map(([cat, label]) => (
              <div key={cat}>
                <h4 className="mb-2 text-sm font-medium">{label}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedPrompts
                    .filter((p) => p.category === cat)
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSelect(p.prompt)
                          setExploreOpen(false)
                        }}
                        className="rounded-full border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent hover:text-primary-foreground"
                      >
                        {p.label}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
