/**
 * ShareSkillModal — share a skill as a public GitHub Gist.
 *
 * Win theme: "Team Knowledge That Compounds"
 * Every skill shared becomes a reusable asset for your team.
 */

import { useState } from 'react'
import { ExternalLink, Github, Share2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  shareSkillAsGist,
  hasGithubToken,
  setGithubToken,
  type GistInfo
} from '@/lib/gist'
import { sendActivityEvent } from '@/lib/platform'

interface Props {
  skillName: string
  contentMd: string
  onClose: () => void
}

export function ShareSkillModal({ skillName, contentMd, onClose }: Props) {
  const [step, setStep] = useState<'share' | 'github-auth' | 'done'>('share')
  const [description, setDescription] = useState('')
  const [tokenDraft, setTokenDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<GistInfo | null>(null)

  async function handleShare() {
    setSaving(true)
    try {
      const connected = await hasGithubToken()
      if (!connected) {
        setStep('github-auth')
        setSaving(false)
        return
      }
      await doShare()
    } catch (e: any) {
      toast.error(e?.message ?? 'Share failed')
      setSaving(false)
    }
  }

  async function handleSaveToken() {
    if (!tokenDraft.trim()) return
    setSaving(true)
    try {
      await setGithubToken(tokenDraft.trim())
      await doShare()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to connect GitHub')
      setSaving(false)
    }
  }

  async function doShare() {
    try {
      // Append brand footer to content
      const footer = `\n\n---\n*Generated with [SkillDeck](https://skilldeck.dev) – local‑first AI orchestration for developers.*`
      const finalContent = contentMd + footer

      const gist = await shareSkillAsGist({
        skillName,
        contentMd: finalContent,
        description: description || `SkillDeck skill: ${skillName}`
      })
      setResult(gist)
      setStep('done')
      sendActivityEvent('skill_shared', { skill_name: skillName }).catch(
        () => { }
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Share2 size={16} className="text-primary" />
            <span className="font-semibold text-sm">Share Skill</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-md">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'share' && (
            <>
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
                <p className="font-medium mb-1">
                  Your best prompts shouldn't die in a chat.
                </p>
                <p className="text-muted-foreground text-xs">
                  Sharing <strong>{skillName}</strong> as a public Gist lets
                  your team install it in one click. Knowledge compounds when
                  it's accessible.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  Description (optional)
                </label>
                <input
                  type="text"
                  placeholder={`SkillDeck skill: ${skillName}`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                onClick={handleShare}
                disabled={saving}
                className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Github size={14} />
                {saving ? 'Sharing…' : 'Share as GitHub Gist'}
              </button>
            </>
          )}

          {step === 'github-auth' && (
            <>
              <div className="text-sm text-muted-foreground">
                <p className="mb-3">
                  A GitHub Personal Access Token with{' '}
                  <code className="text-xs bg-muted px-1 rounded">gist</code>{' '}
                  scope is needed to create public Gists.
                </p>
                <a
                  href="https://github.com/settings/tokens/new?scopes=gist&description=SkillDeck"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline text-xs mb-4"
                >
                  Create a token on GitHub <ExternalLink size={11} />
                </a>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">GitHub Token</label>
                <input
                  type="password"
                  placeholder="ghp_…"
                  value={tokenDraft}
                  onChange={(e) => setTokenDraft(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  Stored securely in your OS keychain.
                </p>
              </div>
              <button
                onClick={handleSaveToken}
                disabled={!tokenDraft.trim() || saving}
                className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Connecting…' : 'Connect & share'}
              </button>
            </>
          )}

          {step === 'done' && result && (
            <>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 text-sm">
                <p className="font-medium text-emerald-800 dark:text-emerald-300 mb-1">
                  Skill shared! 🎉
                </p>
                <p className="text-emerald-700 dark:text-emerald-400 text-xs">
                  Your team can now install <strong>{skillName}</strong> with
                  one click.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Gist URL
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded overflow-hidden text-ellipsis whitespace-nowrap">
                    {result.html_url}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result.html_url)
                      toast.success('Copied!')
                    }}
                    className="text-xs text-primary hover:underline whitespace-nowrap"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <a
                href={result.html_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-border hover:bg-muted text-sm transition-colors"
              >
                View on GitHub <ExternalLink size={13} />
              </a>
              <button
                onClick={onClose}
                className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
