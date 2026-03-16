/**
 * CommunitySkillsTab — browse and one-click install community skills from GitHub Gists.
 *
 * Win theme: "Team Knowledge That Compounds"
 */

import { useState } from 'react'
import { Download, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { importSkillFromGist } from '@/lib/gist'
import { sendActivityEvent } from '@/lib/platform'

interface CommunitySkill {
  id: string
  name: string
  description: string
  author: string
  gistId: string
  stars: number
  tags: string[]
}

// Curated community skills – in production this would be fetched from the
// skilldeck-community GitHub repo or a platform endpoint.
const CURATED_SKILLS: CommunitySkill[] = [
  {
    id: '1',
    name: 'code-review',
    description:
      'Structured code review with severity levels, actionable suggestions, and team-style comments.',
    author: 'elcoosp',
    gistId: '',
    stars: 42,
    tags: ['engineering', 'quality']
  },
  {
    id: '2',
    name: 'pr-description',
    description:
      'Generate clear, comprehensive pull request descriptions from diff context.',
    author: 'elcoosp',
    gistId: '',
    stars: 38,
    tags: ['engineering', 'writing']
  },
  {
    id: '3',
    name: 'standup-notes',
    description:
      "Summarise yesterday's commits and today's tasks into a concise standup update.",
    author: 'elcoosp',
    gistId: '',
    stars: 29,
    tags: ['productivity', 'writing']
  },
  {
    id: '4',
    name: 'sql-optimizer',
    description:
      'Analyse and optimise SQL queries with explanations and index suggestions.',
    author: 'elcoosp',
    gistId: '',
    stars: 24,
    tags: ['database', 'engineering']
  }
]

interface Props {
  /** Called after successful import with (skillName, contentMd) */
  onInstall: (skillName: string, contentMd: string) => void
}

export function CommunitySkillsTab({ onInstall }: Props) {
  const [query, setQuery] = useState('')
  const [installing, setInstalling] = useState<string | null>(null)
  const [gistImportId, setGistImportId] = useState('')
  const [importing, setImporting] = useState(false)

  const filtered = CURATED_SKILLS.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.description.toLowerCase().includes(query.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  )

  async function installSkill(skill: CommunitySkill) {
    if (!skill.gistId) {
      toast.info('This skill is coming soon — check back after launch!')
      return
    }
    setInstalling(skill.id)
    try {
      const file = await importSkillFromGist(skill.gistId)
      onInstall(skill.name, file.content)
      sendActivityEvent('skill_created', {
        source: 'community',
        skill_name: skill.name
      }).catch(() => { })
      toast.success(`${skill.name} installed!`)
    } catch (e: any) {
      toast.error(e?.message ?? 'Install failed')
    } finally {
      setInstalling(null)
    }
  }

  async function importFromGist() {
    const id = gistImportId.trim()
    if (!id) return
    setImporting(true)
    try {
      // Support full URL or bare ID
      const gistId = id.includes('gist.github.com/')
        ? (id.split('/').pop() ?? id)
        : id
      const file = await importSkillFromGist(gistId)
      const skillName = file.filename.replace(/\.md$/, '') || 'imported-skill'
      onInstall(skillName, file.content)
      sendActivityEvent('skill_created', { source: 'gist_import' }).catch(
        () => { }
      )
      toast.success(`${skillName} imported!`)
      setGistImportId('')
    } catch (e: any) {
      toast.error(e?.message ?? 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div>
          <h3 className="font-semibold text-sm">Community Skills</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            One-click install from the community. Skills are version-controlled
            — contribute yours.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search skills…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              <X size={12} className="text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Gist import */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Import from Gist URL or ID…"
            value={gistImportId}
            onChange={(e) => setGistImportId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && importFromGist()}
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={importFromGist}
            disabled={!gistImportId.trim() || importing}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {importing ? '…' : 'Import'}
          </button>
        </div>
      </div>

      {/* Skill list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No skills match "{query}"
          </div>
        ) : (
          filtered.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              installing={installing === skill.id}
              onInstall={() => installSkill(skill)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function SkillCard({
  skill,
  installing,
  onInstall
}: {
  skill: CommunitySkill
  installing: boolean
  onInstall: () => void
}) {
  return (
    <div className="rounded-lg border border-border p-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <span className="text-sm font-medium font-mono">{skill.name}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            by {skill.author}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground">
            ⭐ {skill.stars}
          </span>
          <button
            onClick={onInstall}
            disabled={installing}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium disabled:opacity-50 transition-colors"
          >
            <Download size={11} />
            {installing ? '…' : 'Install'}
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">
        {skill.description}
      </p>
      <div className="flex flex-wrap gap-1 mt-2">
        {skill.tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
