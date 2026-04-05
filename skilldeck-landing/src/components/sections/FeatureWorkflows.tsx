'use client'

import { useLingui } from '@lingui/react/macro'
import { Check, Eye, GitFork, Save, Workflow } from 'lucide-react'

function BulletItem({
	icon: Icon,
	text,
}: {
	icon: React.ComponentType<{ className?: string }>
	text: string
}) {
	return (
		<li className="flex items-start gap-3">
			<div className="w-8 h-8 rounded-lg bg-[#ff8a4c]/10 flex items-center justify-center shrink-0 mt-0.5">
				<Icon className="w-4 h-4 text-[#ff8a4c]" />
			</div>
			<span className="text-muted-foreground leading-relaxed">{text}</span>
		</li>
	)
}

export function FeatureWorkflows() {
	const { t } = useLingui()

	const BULLET_POINTS = [
		{ icon: Workflow, text: t`Sequential — steps execute one after another in topological order` },
		{
			icon: GitFork,
			text: t`Parallel — independent steps launch simultaneously with Tokio JoinSet`,
		},
		{
			icon: Eye,
			text: t`Evaluator-Optimizer — iterative loop that re-optimizes output up to five times`,
		},
		{ icon: Save, text: t`Real-time status — step nodes update live on the graph as they run` },
	] as const

	return (
		<section className="pt-20 pb-28 relative">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
					{/* Text content */}
					<div>
						<h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
							{t`Build it once.`}
							<br />
							<span className="gradient-blue">{t`Run it forever.`}</span>
						</h2>
						<p className="mt-4 text-lg text-muted-foreground leading-relaxed">
							{t`Design multi-step AI pipelines on a visual canvas, pick an execution pattern, and watch them run with live step tracking. No scripting required.`}
						</p>
						<ul className="mt-8 space-y-4">
							{BULLET_POINTS.map((point) => (
								<BulletItem key={point.text} icon={point.icon} text={point.text} />
							))}
						</ul>
					</div>

					{/* Visual mockup — workflow graph */}
					<div>
						<div className="bg-card border border-border rounded-2xl p-6">
							<div className="flex items-center gap-2 mb-4">
								<Workflow className="w-4 h-4 text-[#ff8a4c]" />
								<span className="text-sm font-medium text-foreground">{t`Code Review Workflow`}</span>
								<span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-500">{t`Active`}</span>
							</div>
							{/* Simplified workflow graph visualization */}
							<div className="space-y-4">
								{/* Node 1 */}
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-sm font-bold text-primary shrink-0">
										1
									</div>
									<div className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5">
										<p className="text-sm font-medium text-foreground">{t`Analyze Diff`}</p>
										<p className="text-xs text-muted-foreground">Claude 3.5 Sonnet</p>
									</div>
								</div>
								<div className="ml-5 border-l-2 border-border pl-5 h-2" />
								{/* Node 2 */}
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-xl bg-[#ff8a4c]/20 border border-[#ff8a4c]/30 flex items-center justify-center text-sm font-bold text-[#ff8a4c] shrink-0">
										2
									</div>
									<div className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5">
										<p className="text-sm font-medium text-foreground">{t`Run Lint & Tests`}</p>
										<p className="text-xs text-muted-foreground">Ollama / CodeLlama</p>
									</div>
								</div>
								<div className="ml-5 border-l-2 border-border pl-5 h-2" />
								{/* Node 3 */}
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-sm font-bold text-amber-400 shrink-0">
										3
									</div>
									<div className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5">
										<p className="text-sm font-medium text-foreground">{t`Generate Review`}</p>
										<p className="text-xs text-muted-foreground">GPT-4o</p>
									</div>
								</div>
								<div className="ml-5 border-l-2 border-border pl-5 h-2" />
								{/* Node 4 — Approval */}
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-sm font-bold text-emerald-500 shrink-0">
										<Check className="w-4 h-4" />
									</div>
									<div className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5 border-emerald-500/20">
										<p className="text-sm font-medium text-foreground">{t`Approval Gate`}</p>
										<p className="text-xs text-emerald-500">{t`Awaiting human review`}</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
