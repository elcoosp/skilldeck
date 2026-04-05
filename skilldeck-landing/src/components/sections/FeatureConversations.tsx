'use client'

import { useLingui } from '@lingui/react/macro'
import { Clock, GitBranch, MessageSquare, RotateCcw } from 'lucide-react'

function BulletItem({
	icon: Icon,
	text,
}: {
	icon: React.ComponentType<{ className?: string }>
	text: string
}) {
	return (
		<li className="flex items-start gap-3">
			<div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
				<Icon className="w-4 h-4 text-emerald-500" />
			</div>
			<span className="text-muted-foreground leading-relaxed">{text}</span>
		</li>
	)
}

export function FeatureConversations() {
	const { t } = useLingui()

	const BULLET_POINTS = [
		{
			icon: GitBranch,
			text: t`Branch from any message to explore different approaches side by side`,
		},
		{
			icon: MessageSquare,
			text: t`Thread replies under specific messages to keep discussions focused`,
		},
		{
			icon: RotateCcw,
			text: t`Artifacts capture AI-generated code with full version history and rollback`,
		},
		{ icon: Clock, text: t`Message Queue batches multiple prompts and processes them in order` },
	] as const

	return (
		<section className="py-24 relative">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
					{/* Visual mockup — conversation branching */}
					<div className="order-2 lg:order-1">
						<div className="bg-card border border-border rounded-2xl p-6">
							<div className="flex items-center gap-2 mb-5">
								<MessageSquare className="w-4 h-4 text-emerald-500" />
								<span className="text-sm font-medium text-foreground">{t`Conversation — code-review`}</span>
							</div>
							{/* Conversation tree */}
							<div className="space-y-3">
								<div className="flex gap-3">
									<div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs text-primary shrink-0 mt-1">
										U
									</div>
									<div className="bg-card border border-border rounded-lg px-3 py-2 max-w-xs">
										<p className="text-sm text-foreground">{t`Review the authentication module changes`}</p>
									</div>
								</div>
								<div className="flex gap-3">
									<div className="w-7 h-7 rounded-full bg-[#ff8a4c]/20 flex items-center justify-center text-xs text-[#ff8a4c] shrink-0 mt-1">
										A
									</div>
									<div className="bg-card border border-border rounded-lg px-3 py-2 max-w-xs">
										<p className="text-sm text-foreground">{t`I found 3 potential issues in the JWT implementation...`}</p>
									</div>
								</div>
								{/* Branch point */}
								<div className="flex items-center gap-2 ml-3.5">
									<div className="w-px h-4 bg-border" />
									<span className="text-xs text-muted-foreground">{t`branched`}</span>
								</div>
								<div className="grid grid-cols-2 gap-3 ml-3.5">
									<div className="border-l-2 border-primary pl-3 space-y-2">
										<span className="text-xs text-primary font-medium">{t`Branch A: Fix JWT`}</span>
										<div className="bg-card border border-border rounded-lg px-3 py-2">
											<p className="text-xs text-foreground">{t`Rewrite using RS256...`}</p>
										</div>
									</div>
									<div className="border-l-2 border-[#ff8a4c] pl-3 space-y-2">
										<span className="text-xs text-[#ff8a4c] font-medium">{t`Branch B: Keep HS256`}</span>
										<div className="bg-card border border-border rounded-lg px-3 py-2">
											<p className="text-xs text-foreground">{t`Add rotation logic...`}</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Text content */}
					<div className="order-1 lg:order-2">
						<h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
							{t`Explore different approaches`}
							<br />
							<span className="gradient-text">{t`without losing context`}</span>
						</h2>
						<p className="mt-4 text-lg text-muted-foreground leading-relaxed">
							{t`Non-linear conversations with branching, threading, artifacts, and batch processing. Try multiple directions at once and compare results.`}
						</p>
						<ul className="mt-8 space-y-4">
							{BULLET_POINTS.map((point) => (
								<BulletItem key={point.text} icon={point.icon} text={point.text} />
							))}
						</ul>
					</div>
				</div>
			</div>
		</section>
	)
}
