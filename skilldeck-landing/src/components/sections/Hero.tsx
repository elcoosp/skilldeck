'use client'

import { useLingui } from '@lingui/react/macro'
import { ArrowRight, Bot, Download, Github, LockOpen, Shield, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useABTest } from '@/contexts/ABTestContext'
import { getDownloadLabel } from '@/lib/platform'

/* ── Mobile: compact chat card ── */
function MobileMockup() {
	const { t } = useLingui()
	return (
		<div className="sm:hidden rounded-2xl border border-border bg-card p-4 space-y-3">
			<div className="flex items-center gap-2">
				<div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
					<span className="text-[10px] font-bold text-white">SD</span>
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium text-foreground truncate">{t('Code Review')}</p>
					<p className="text-[10px] text-emerald-500">Claude 3.5 Sonnet</p>
				</div>
				<span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
			</div>
			<div className="space-y-2">
				<div className="flex gap-2 items-start">
					<div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[9px] text-primary shrink-0 mt-0.5">
						U
					</div>
					<div className="bg-background rounded-lg rounded-tl-none px-2.5 py-1.5 text-xs text-foreground">
						{t('Review the auth module')}
					</div>
				</div>
				<div className="flex gap-2 items-start">
					<div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[9px] text-emerald-500 shrink-0 mt-0.5">
						A
					</div>
					<div className="bg-background rounded-lg rounded-tl-none px-2.5 py-1.5 text-xs text-foreground">
						{t('Found 3 issues in the JWT implementation.')}
					</div>
				</div>
			</div>
			<div className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-2.5 py-2">
				<span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
				<span className="text-[10px] text-amber-400">{t('Awaiting your review')}</span>
			</div>
		</div>
	)
}

/* ── Desktop: full app window ── */
function DesktopMockup() {
	const { t } = useLingui()
	return (
		<div className="hidden sm:block w-full max-w-2xl mx-auto overflow-hidden">
			<div className="rounded-xl border border-border overflow-hidden bg-card shadow-2xl shadow-blue-500/5">
				<div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
					<div className="w-3 h-3 rounded-full bg-red-500/80" />
					<div className="w-3 h-3 rounded-full bg-yellow-500/80" />
					<div className="w-3 h-3 rounded-full bg-green-500/80" />
					<span className="text-xs text-muted-foreground ml-2 truncate">
						{t('SkillDeck — Code Review')}
					</span>
					<div className="ml-auto flex items-center gap-2 shrink-0">
						<span className="w-2 h-2 rounded-full bg-emerald-500" />
						<span className="text-xs text-emerald-500">Claude 3.5 Sonnet</span>
					</div>
				</div>
				<div className="flex h-80">
					<div className="w-44 border-r border-border bg-background/50 p-3 space-y-2 shrink-0">
						<div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
							{t('Agents')}
						</div>
						<div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">
							<div className="w-2 h-2 rounded-full bg-primary" />
							{t('Coordinator')}
						</div>
						<div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-muted-foreground text-xs hover:bg-white/5">
							<div className="w-2 h-2 rounded-full bg-amber-400" />
							{t('Reviewer')}
						</div>
						<div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-muted-foreground text-xs hover:bg-white/5">
							<div className="w-2 h-2 rounded-full bg-emerald-500" />
							{t('Executor')}
						</div>
						<div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-4 mb-2 font-medium">
							{t('Status')}
						</div>
						<div className="px-2 py-1 text-xs text-muted-foreground">{t('3 files changed')}</div>
						<div className="px-2 py-1 text-xs text-emerald-500">{t('Lint passed')}</div>
						<div className="px-2 py-1 text-xs text-primary">{t('3 suggestions')}</div>
					</div>
					<div className="flex-1 flex flex-col min-w-0">
						<div className="flex-1 p-4 space-y-3 overflow-hidden">
							<div className="flex gap-2 items-start">
								<div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] text-primary shrink-0 mt-0.5">
									U
								</div>
								<div className="bg-background rounded-lg px-3 py-2 text-sm text-foreground">
									{t('Review the authentication module changes')}
								</div>
							</div>
							<div className="flex gap-2 items-start">
								<div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] text-emerald-500 shrink-0 mt-0.5">
									A
								</div>
								<div className="space-y-2 min-w-0">
									<div className="bg-background rounded-lg px-3 py-2 text-sm text-foreground">
										{t(
											'I found 3 potential issues in the JWT implementation. Running deeper analysis...',
										)}
									</div>
									<div className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-1.5">
										<span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
										<span className="text-xs text-amber-400">
											{t('Approval gate: awaiting human review')}
										</span>
									</div>
								</div>
							</div>
						</div>
						<div className="border-t border-border px-3 py-2">
							<div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 text-xs text-muted-foreground">
								<span>{t('Type a message...')}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

function AppMockup() {
	return (
		<div className="mt-12">
			<MobileMockup />
			<DesktopMockup />
		</div>
	)
}

function TrustBadgeItem({
	icon: Icon,
	label,
	desc,
}: {
	icon: React.ComponentType<{ className?: string }>
	label: string
	desc: string
}) {
	return (
		<div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
			<div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
				<Icon className="w-4 h-4 text-primary" />
			</div>
			<div className="min-w-0">
				<p className="text-sm font-medium text-foreground">{label}</p>
				<p className="text-xs text-muted-foreground truncate">{desc}</p>
			</div>
		</div>
	)
}

export function Hero() {
	const { t } = useLingui()
	const [downloadLabel, setDownloadLabel] = useState('Download')
	const [ready, setReady] = useState(false)
	const { getVariant } = useABTest()

	useEffect(() => {
		setDownloadLabel(getDownloadLabel())
		setReady(true)
	}, [])

	const headlineVariant = getVariant('hero') ?? 'problem'
	const ctaVariant = getVariant('hero_cta') ?? 'platform'

	const headline =
		headlineVariant === 'outcome'
			? t('Run AI agents, workflows, and tools')
			: t('Stop stitching together')

	const headlineGradient =
		headlineVariant === 'outcome'
			? t('from a single desktop app.')
			: t("AI tools that don't talk to each other.")

	const subheadline =
		headlineVariant === 'outcome'
			? t(
					'SkillDeck gives you multi-agent orchestration, a visual workflow editor, and a skill system with built-in linting — all running locally on macOS, Windows, or Linux. No account, no cloud, no vendor lock-in.',
				)
			: t(
					'SkillDeck puts multi-agent orchestration, visual workflows, and skill-based AI in one desktop app. Everything runs locally — your prompts, your code, your API keys never leave your machine.',
				)

	const ctaText = ctaVariant === 'platform' ? downloadLabel : t('Get SkillDeck Free')

	const trustBadges = [
		{ icon: Shield, label: t('Local-First'), desc: t('All data stays on your machine') },
		{ icon: Zap, label: t('Rust-Powered'), desc: t('Built with Tauri 2 for native speed') },
		{ icon: LockOpen, label: t('Open Source'), desc: t('MIT License') },
		{ icon: Bot, label: t('Multi-LLM'), desc: t('OpenAI, Claude, Ollama & more') },
	]

	if (!ready) {
		return (
			<section className="relative min-h-screen flex flex-col items-center justify-center bg-background overflow-hidden">
				<div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-blue-500/15 via-blue-400/8 to-transparent rounded-full blur-3xl pointer-events-none" />
				<div className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 text-center">
					<div className="h-48 sm:h-32" />
				</div>
			</section>
		)
	}

	return (
		<section className="relative min-h-screen flex flex-col items-center justify-center bg-background overflow-hidden">
			<div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-blue-500/15 via-blue-400/8 to-transparent rounded-full blur-3xl pointer-events-none" />
			<div className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 text-center">
				<h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight text-foreground">
					{headline}
					<br />
					<span className="gradient-text">{headlineGradient}</span>
				</h1>
				<p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
					{subheadline}
				</p>
				<div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
					<Button
						size="lg"
						className="bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300 text-white border-0 shadow-lg shadow-blue-500/25 text-base px-8 py-6"
					>
						<Download className="w-5 h-5 mr-2" />
						{ctaText}
					</Button>
					<Button
						variant="outline"
						size="lg"
						className="border-border hover:bg-white/5 text-foreground text-base px-8 py-6"
						asChild
					>
						<a
							href="https://github.com/elcoosp/skilldeck"
							target="_blank"
							rel="noopener noreferrer"
						>
							<Github className="w-5 h-5 mr-2" />
							{t('View on GitHub')}
							<ArrowRight className="w-4 h-4 ml-1" />
						</a>
					</Button>
				</div>
				<AppMockup />
				<div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
					{trustBadges.map((badge) => (
						<TrustBadgeItem
							key={badge.label}
							icon={badge.icon}
							label={badge.label}
							desc={badge.desc}
						/>
					))}
				</div>
			</div>
		</section>
	)
}
