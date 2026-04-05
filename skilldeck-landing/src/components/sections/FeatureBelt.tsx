'use client'

import { useLingui } from '@lingui/react/macro'
import { GitBranch, Puzzle, Shield } from 'lucide-react'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { useABTest } from '@/contexts/ABTestContext'

function FeatureCard({
	icon: Icon,
	title,
	description,
	bgColor,
}: {
	icon: React.ComponentType<{ className?: string }>
	title: string
	description: string
	bgColor: string
}) {
	return (
		<div className="bg-card border border-border rounded-2xl p-6 lg:p-8 hover:border-primary/20 transition-all duration-300 group h-full">
			<div
				className={`w-12 h-12 shrink-0 rounded-xl ${bgColor} flex items-center justify-center p-2.5 mb-5`}
			>
				<Icon className="w-6 h-6 text-blue-500" />
			</div>
			<h3 className="text-xl font-bold mb-3 text-foreground">{title}</h3>
			<p className="text-muted-foreground leading-relaxed">{description}</p>
		</div>
	)
}

export function FeatureBelt() {
	const { t } = useLingui()
	const { getVariant } = useABTest()
	const headingVariant = getVariant('belt_heading') ?? 'specific'

	const title =
		headingVariant === 'specific' ? (
			<>
				{t`One app replaces your`} <span className="gradient-blue">{t`AI toolchain`}</span>
			</>
		) : (
			<>
				{t`Everything you need for`} <span className="gradient-blue">{t`AI orchestration`}</span>
			</>
		)

	const description =
		headingVariant === 'specific'
			? t`Stop bouncing between browser tabs, cloud services, and tools that send your code to someone else's servers. SkillDeck gives you a single native app that handles orchestration, workflows, and skills — no subscription required.`
			: t`Stop stitching together cloud AI tools that lock you into one provider and send your code to someone else's servers. SkillDeck gives you a single native app that does it all.`

	const features = [
		{
			icon: GitBranch,
			title: t`Multi-agent orchestration`,
			description: t`Spawn parallel subagents that tackle independent tasks at the same time. Each one runs in its own session with dedicated skills, then reports back. Merge results your way — concatenate, summarize, or vote.`,
			bgColor: 'bg-blue-500/10',
		},
		{
			icon: Puzzle,
			title: t`Visual workflow builder`,
			description: t`Design multi-step AI pipelines on a drag-and-drop canvas. Pick from three execution patterns — Sequential, Parallel, and Evaluator-Optimizer — and let the graph engine handle the rest.`,
			bgColor: 'bg-blue-500/10',
		},
		{
			icon: Shield,
			title: t`Zero cloud dependency`,
			description: t`Conversations, workflow runs, and API keys all live on your machine in SQLite and your OS keychain. Use Ollama for fully offline work. The optional SkillDeck Platform is just that — optional.`,
			bgColor: 'bg-blue-500/10',
		},
	]

	return (
		<section className="pt-24 pb-16 relative" id="features">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<SectionHeading title={title} description={description} />
				<div className="mt-16 grid md:grid-cols-3 gap-6">
					{features.map((feature) => (
						<FeatureCard
							key={feature.title}
							icon={feature.icon}
							title={feature.title}
							description={feature.description}
							bgColor={feature.bgColor}
						/>
					))}
				</div>
			</div>
		</section>
	)
}
