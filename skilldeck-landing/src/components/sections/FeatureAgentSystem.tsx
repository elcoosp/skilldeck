'use client'

import { useLingui } from '@lingui/react/macro'
import { Bot, CheckCircle2, Clock, Cpu, Loader2, Network, ShieldCheck, Zap } from 'lucide-react'

function BulletItem({
	icon: Icon,
	text,
}: {
	icon: React.ComponentType<{ className?: string }>
	text: string
}) {
	return (
		<li className="flex items-start gap-3">
			<div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
				<Icon className="w-4 h-4 text-primary" />
			</div>
			<span className="text-muted-foreground leading-relaxed">{text}</span>
		</li>
	)
}

/* ── Mobile: compact agent card ── */
function MobileAgentMockup() {
	const { t } = useLingui()
	return (
		<div className="lg:hidden rounded-2xl border border-border bg-card p-4 space-y-3">
			<div className="flex items-center gap-2">
				<div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
					<Bot className="w-4 h-4 text-white" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium text-foreground truncate">{t`Code Review`}</p>
					<p className="text-[10px] text-emerald-500">{t`3 agents active`}</p>
				</div>
				<span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
			</div>
			<div className="flex justify-end">
				<div className="bg-blue-500/15 rounded-lg rounded-tr-none px-3 py-1.5 max-w-[80%]">
					<p className="text-xs text-foreground">{t`Review PR #142 and run tests`}</p>
				</div>
			</div>
			<div className="flex flex-wrap gap-1.5">
				<span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
					<CheckCircle2 className="w-3 h-3" />
					{t`Reviewer done`}
				</span>
				<span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400">
					<Clock className="w-3 h-3" />
					{t`Executor running`}
				</span>
			</div>
			<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
				<div className="flex items-center gap-1.5 mb-1.5">
					<ShieldCheck className="w-3 h-3 text-amber-400" />
					<span className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">{t`Approval`}</span>
				</div>
				<p className="text-[10px] text-muted-foreground mb-2">
					<span className="text-foreground font-medium">run_tests</span> --{' '}
					<span className="font-mono text-[10px]">npm test</span>
				</p>
				<div className="flex gap-1.5">
					<span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-medium">{t`Approve`}</span>
					<span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-muted-foreground border border-border font-medium">{t`Deny`}</span>
				</div>
			</div>
			<p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
				<Cpu className="w-3 h-3" />
				{t`Merge:`} <span className="text-foreground font-medium">{t`summarize`}</span> -- 1/2{' '}
				{t`done`}
			</p>
		</div>
	)
}

/* ── Desktop: full agent window ── */
function DesktopAgentMockup() {
	const { t } = useLingui()
	return (
		<div className="hidden lg:block rounded-xl border border-border overflow-hidden bg-card shadow-2xl shadow-blue-500/5">
			<div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
				<div className="w-3 h-3 rounded-full bg-red-500/80" />
				<div className="w-3 h-3 rounded-full bg-yellow-500/80" />
				<div className="w-3 h-3 rounded-full bg-green-500/80" />
				<span className="text-xs text-muted-foreground ml-2">{t`SkillDeck -- Code Review`}</span>
				<span className="ml-auto text-[10px] text-emerald-500 flex items-center gap-1">
					<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
					{t`Connected`}
				</span>
			</div>
			<div className="flex h-[380px]">
				<div className="w-[160px] border-r border-border p-3 flex flex-col gap-2 bg-background/50 shrink-0">
					<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{t`Agents`}</p>
					<div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
						<Bot className="w-3.5 h-3.5 text-primary shrink-0" />
						<span className="text-xs font-medium text-foreground truncate">{t`Coordinator`}</span>
					</div>
					<div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5">
						<Bot className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
						<span className="text-xs text-muted-foreground truncate">{t`Reviewer`}</span>
					</div>
					<div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5">
						<Bot className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
						<span className="text-xs text-muted-foreground truncate">{t`Executor`}</span>
					</div>
					<div className="mt-auto pt-3 border-t border-border/50">
						<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{t`Status`}</p>
						<div className="flex items-center gap-1.5">
							<Loader2 className="w-3 h-3 text-primary animate-spin" />
							<span className="text-[10px] text-muted-foreground">{t`Agent loop running`}</span>
						</div>
						<div className="flex items-center gap-1.5 mt-1">
							<Zap className="w-3 h-3 text-emerald-500" />
							<span className="text-[10px] text-muted-foreground">{t`3 tools dispatched`}</span>
						</div>
					</div>
				</div>
				<div className="flex-1 flex flex-col min-w-0 p-4">
					<div className="flex justify-end mb-3">
						<div className="bg-blue-500/15 border border-blue-500/20 rounded-lg rounded-tr-sm px-3 py-2 max-w-[85%]">
							<p className="text-xs text-foreground">{t`Review the changes in PR #142 and run the test suite.`}</p>
						</div>
					</div>
					<div className="flex justify-start mb-3">
						<div className="max-w-[90%]">
							<p className="text-xs text-muted-foreground mb-2">
								<span className="font-medium text-foreground">{t`Coordinator`}</span> --{' '}
								{t`Spawning subagents for parallel review...`}
							</p>
							<div className="flex gap-2 mb-2">
								<div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
									<CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
									<span className="text-[10px] text-emerald-400">{t`Reviewer`}</span>
								</div>
								<div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
									<Clock className="w-3 h-3 text-blue-400 shrink-0" />
									<span className="text-[10px] text-blue-400">{t`Executor`}</span>
								</div>
							</div>
							<div className="bg-card border border-amber-500/30 rounded-lg p-2.5">
								<div className="flex items-center gap-1.5 mb-1.5">
									<ShieldCheck className="w-3 h-3 text-amber-400" />
									<span className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">{t`Approval Required`}</span>
								</div>
								<p className="text-[10px] text-muted-foreground mb-2">
									<span className="text-foreground font-medium">run_tests</span> --{' '}
									{t`Execute test suite with`} <span className="font-mono text-xs">npm test</span>
								</p>
								<div className="flex gap-1.5">
									<span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-medium">{t`Approve`}</span>
									<span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-muted-foreground border border-border font-medium">{t`Deny`}</span>
									<span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-muted-foreground border border-border font-medium">{t`Edit`}</span>
								</div>
							</div>
						</div>
					</div>
					<div className="mt-auto pt-2 border-t border-border/30">
						<p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
							<Cpu className="w-3 h-3" />
							{t`Merge strategy:`}{' '}
							<span className="text-foreground font-medium">{t`summarize`}</span> --{' '}
							{t`Waiting for 1/2 subagents`}
						</p>
					</div>
				</div>
			</div>
		</div>
	)
}

export function FeatureAgentSystem() {
	const { t } = useLingui()

	const bulletPoints = [
		{ icon: Zap, text: t`Streaming agent loop — see tokens arrive in real time as agents work` },
		{
			icon: ShieldCheck,
			text: t`Tool Approval Gate — review, edit, or block every external call before it executes`,
		},
		{
			icon: Cpu,
			text: t`Parallel subagent spawning — merge results with concat, summarize, or vote strategies`,
		},
		{
			icon: Network,
			text: t`Subagent cards with live status, progress tracking, and instant result access`,
		},
	]

	return (
		<section className="py-24 relative">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
					<div>
						<h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
							{t`Agents that actually`}
							<br />
							<span className="gradient-text">{t`work together`}</span>
						</h2>
						<p className="mt-4 text-lg text-muted-foreground leading-relaxed">
							{t`Not just another chat window. A real agent loop that dispatches tools, spawns parallel workers for independent tasks, and asks your permission before running anything risky.`}
						</p>
						<ul className="mt-8 space-y-4">
							{bulletPoints.map((point) => (
								<BulletItem key={point.text} icon={point.icon} text={point.text} />
							))}
						</ul>
					</div>
					<div className="overflow-hidden min-w-0">
						<MobileAgentMockup />
						<DesktopAgentMockup />
					</div>
				</div>
			</div>
		</section>
	)
}
