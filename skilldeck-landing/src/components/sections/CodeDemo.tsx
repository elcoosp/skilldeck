'use client'

import { useLingui } from '@lingui/react/macro'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { useTypingAnimation } from '@/hooks/useTypingAnimation'

const DEMO_TEXT = `---
name: code-review
description: "Review code changes for bugs, security issues, and style violations"
license: MIT
compatibility: ["claude-3", "gpt-4"]
allowed_tools: []
---

# Code Review

## What this skill does

Reviews the current git diff and reports
issues sorted by severity.

## Steps

1. Run \`git diff --staged\` to get changes
2. For each changed file, check for:
   - Null/undefined access patterns
   - Missing error handling on async calls
   - Hardcoded secrets or API keys
   - Unbounded loops or recursive calls
3. Group findings by severity (HIGH / MED / LOW)
4. Output a table with file, line, and fix

## Output

| Severity | File | Line | Issue |
|----------|------|------|-------|
| HIGH     | ...  | ...  | ...   |`

export function CodeDemo() {
	const { t } = useLingui()
	const { displayText } = useTypingAnimation(DEMO_TEXT, 8, 800)
	const lines = displayText.split('\n')

	return (
		<section className="py-24 relative">
			<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
				<SectionHeading
					title={t`One Markdown file. That's the whole skill.`}
					description={t`Each skill is a SKILL.md with YAML frontmatter. The linter validates name, description, license, and content quality before the agent ever sees it.`}
				/>
				<div className="mt-12">
					<div className="rounded-xl border border-border overflow-hidden bg-card shadow-2xl shadow-blue-500/5">
						<div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
							<div className="w-3 h-3 rounded-full bg-red-500/80" />
							<div className="w-3 h-3 rounded-full bg-yellow-500/80" />
							<div className="w-3 h-3 rounded-full bg-green-500/80" />
							<span className="text-xs text-muted-foreground ml-2">code-review/SKILL.md</span>
							<div className="ml-auto flex items-center gap-2">
								<span className="text-xs text-blue-400">Markdown</span>
								<span className="text-xs text-muted-foreground">UTF-8</span>
							</div>
						</div>
						<div className="p-5 font-mono text-sm leading-relaxed overflow-x-auto max-h-[500px]">
							{lines.map((line, idx) => (
								<CodeLine key={idx} line={line} lineNumber={idx + 1} />
							))}
							{displayText.length < DEMO_TEXT.length ? (
								<span className="inline-block w-2 h-4 bg-primary animate-typing-cursor ml-0.5" />
							) : null}
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

function CodeLine({ line, lineNumber }: { line: string; lineNumber: number }) {
	let className = 'text-muted-foreground'
	const trimmed = line.trim()
	if (trimmed.startsWith('#')) className = 'text-muted-foreground/50 italic'
	else if (trimmed.startsWith('---')) className = 'text-muted-foreground/30'
	else if (
		trimmed.startsWith('name:') ||
		trimmed.startsWith('license:') ||
		trimmed.startsWith('allowed_tools:')
	)
		className = 'text-primary'
	else if (trimmed.startsWith('description:')) className = 'text-blue-400'
	else if (trimmed.startsWith('compatibility:')) className = 'text-primary'
	else if (trimmed.includes('"')) className = 'text-amber-400/80'
	else if (
		trimmed.startsWith('1.') ||
		trimmed.startsWith('2.') ||
		trimmed.startsWith('3.') ||
		trimmed.startsWith('4.')
	)
		className = 'text-foreground'
	else if (trimmed.startsWith('- ')) className = 'text-foreground'
	else if (trimmed.startsWith('|')) className = 'text-emerald-500/70'
	else if (
		trimmed.startsWith('Run') ||
		trimmed.startsWith('For each') ||
		trimmed.startsWith('Group') ||
		trimmed.startsWith('Output')
	)
		className = 'text-foreground'

	return (
		<div className="flex hover:bg-white/[0.02] -mx-5 px-5">
			<span className="select-none text-muted-foreground/30 w-8 text-right mr-4 shrink-0">
				{lineNumber}
			</span>
			<span className={className}>{line || ' '}</span>
		</div>
	)
}
