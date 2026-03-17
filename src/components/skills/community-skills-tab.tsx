/**
 * CommunitySkillsTab — browse and one-click install community skills from the platform registry.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Search, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { RegistrySkillData } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import { sendActivityEvent } from '@/lib/platform'

interface Props {
  onInstall?: (skillName: string) => void
}

export function CommunitySkillsTab({ onInstall }: Props) {
  const [query, setQuery] = useState('')
  const queryClient = useQueryClient()

  // Fetch registry skills
  const {
    data: skills = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['registry-skills'],
    queryFn: async () => {
      const res = await commands.fetchRegistrySkills(null, null)
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    }
  })

  const installMutation = useMutation({
    mutationFn: async (skill: RegistrySkillData) => {
      // Use installSkill with registry source; cast to any if command not yet typed
      const res = await (commands as any).installSkill({
        skillName: skill.name,
        skillContent: skill.content,
        target: 'personal',
        source: 'registry'
      })
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: (_data, skill) => {
      queryClient.invalidateQueries({ queryKey: ['skills'] }) // refresh local skills
      toast.success(`${skill.name} installed!`)
      sendActivityEvent('skill_created', {
        source: 'community',
        skill_name: skill.name
      }).catch(() => {})
      onInstall?.(skill.name)
    },
    onError: (err: any) => {
      toast.error(`Install failed: ${err.message}`)
    }
  })

  const filtered = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.description.toLowerCase().includes(query.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  )

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">Loading community skills...</div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        Failed to load community skills. Please check your connection.
      </div>
    )
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
              installing={
                installMutation.isPending &&
                installMutation.variables?.id === skill.id
              }
              onInstall={() => installMutation.mutate(skill)}
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
  skill: RegistrySkillData
  installing: boolean
  onInstall: () => void
}) {
  return (
    <div className="rounded-lg border border-border p-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <span className="text-sm font-medium font-mono">{skill.name}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            by {skill.author || 'Unknown'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
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
        {skill.tags.slice(0, 3).map((tag) => (
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
