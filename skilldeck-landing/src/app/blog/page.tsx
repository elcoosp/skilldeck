import type { Metadata } from 'next'
import Link from 'next/link'
import { PageLayout } from '@/components/shared/PageLayout'
import { getBlogPosts } from '@/lib/blog'

export const metadata: Metadata = {
	title: 'Blog',
	description:
		'SkillDeck blog. Technical deep dives, feature announcements, and guides for building AI workflows.',
}

export default function BlogPage() {
	const posts = getBlogPosts()

	return (
		<PageLayout>
			<div className="py-16 sm:py-24">
				<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
					<h1 className="text-4xl font-bold tracking-tight mb-4">Blog</h1>
					<p className="text-lg text-muted-foreground mb-12">
						Technical deep dives, feature announcements, and guides for building AI workflows.
					</p>

					<div className="space-y-8">
						{posts.map((post) => (
							<article key={post.slug}>
								<Link href={`/blog/${post.slug}`} className="group block">
									<div className="glass rounded-2xl p-6 border border-border hover:border-primary/20 transition-all duration-300">
										<div className="flex items-center gap-3 mb-3">
											<time className="text-sm text-muted-foreground">{post.date}</time>
											<span className="text-muted-foreground">by {post.author}</span>
										</div>
										<h2 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
											{post.title}
										</h2>
										<p className="text-muted-foreground leading-relaxed">{post.excerpt}</p>
										<span className="inline-block mt-4 text-sm text-primary group-hover:underline">
											Read more
										</span>
									</div>
								</Link>
							</article>
						))}
					</div>
				</div>
			</div>
		</PageLayout>
	)
}
