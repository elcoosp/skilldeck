'use client'

import { useLingui } from '@lingui/react/macro'
import { Github, Layers } from 'lucide-react'

function SkillDeckLogo() {
	return (
		<div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-sm">
			<Layers className="w-4 h-4 text-white" />
		</div>
	)
}

export function Footer() {
	const { t } = useLingui()

	const footerLinks: Record<string, { label: string; href: string }[]> = {
		Product: [
			{ label: t`Features`, href: '/#features' },
			{ label: t`Download`, href: '/download' },
			{ label: t`Compare`, href: '/compare' },
			{ label: t`Changelog`, href: '/changelog' },
		],
		Resources: [
			{ label: t`Documentation`, href: 'https://github.com/elcoosp/skilldeck#readme' },
			{ label: t`Blog`, href: '/blog' },
			{ label: t`FAQ`, href: '/faq' },
			{ label: t`How It Works`, href: '/#how-it-works' },
		],
		Community: [
			{ label: t`GitHub`, href: 'https://github.com/elcoosp/skilldeck' },
			{
				label: t`Contributing`,
				href: 'https://github.com/elcoosp/skilldeck/blob/main/CONTRIBUTING.md',
			},
		],
		Legal: [
			{ label: t`MIT License`, href: 'https://github.com/elcoosp/skilldeck/blob/main/LICENSE' },
			{ label: t`Privacy Policy`, href: '/privacy' },
			{ label: t`Security`, href: '/security' },
			{ label: t`Terms of Use`, href: '/terms' },
		],
	}

	return (
		<footer className="border-t border-border bg-background">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="py-12 lg:py-16">
					<div className="grid grid-cols-2 md:grid-cols-5 gap-8">
						<div className="col-span-2 md:col-span-1">
							<a href="/" className="flex items-center gap-2 mb-4">
								<SkillDeckLogo />
								<span className="text-lg font-bold">
									Skill<span className="gradient-blue">Deck</span>
								</span>
							</a>
							<p className="text-sm text-muted-foreground leading-relaxed mb-4">{t`Local-first AI orchestration for developers who ship.`}</p>
							<a
								href="https://github.com/elcoosp/skilldeck"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
							>
								<Github className="w-4 h-4" />
								{t`Star us on GitHub`}
							</a>
						</div>
						{Object.entries(footerLinks).map(([category, links]) => (
							<div key={category}>
								<h3 className="text-sm font-semibold text-foreground mb-3">{category}</h3>
								<ul className="space-y-2">
									{links.map((link) => (
										<li key={link.label}>
											<a
												href={link.href}
												className="text-sm text-muted-foreground hover:text-foreground transition-colors"
												{...(link.href.startsWith('http')
													? { target: '_blank', rel: 'noopener noreferrer' }
													: {})}
											>
												{link.label}
											</a>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
					<div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
						<p className="text-sm text-muted-foreground">
							&copy; {new Date().getFullYear()} SkillDeck. {t`Open source under MIT License.`}
						</p>
					</div>
				</div>
			</div>
		</footer>
	)
}
