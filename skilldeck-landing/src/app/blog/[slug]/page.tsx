import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageLayout } from '@/components/shared/PageLayout'
import { getBlogPost, getAllBlogSlugs } from '@/lib/blog'

interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = getAllBlogSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)
  return {
    title: post?.title ?? 'Post Not Found',
    description: post?.excerpt ?? '',
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = getBlogPost(slug)

  if (!post) {
    notFound()
  }

  return (
    <PageLayout>
      <div className="py-16 sm:py-24">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            &larr; Back to Blog
          </Link>

          <header className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{post.title}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <time>{post.date}</time>
              <span>by {post.author}</span>
            </div>
          </header>

          <div className="prose prose-invert prose-slate max-w-none">
            {post.content.split('\n').map((line, i) => {
              if (line.startsWith('# ')) {
                return <h1 key={i} className="text-3xl font-bold text-foreground mt-10 mb-4">{line.replace('# ', '')}</h1>
              }
              if (line.startsWith('## ')) {
                return <h2 key={i} className="text-2xl font-bold text-foreground mt-10 mb-4">{line.replace('## ', '')}</h2>
              }
              if (line.startsWith('### ')) {
                return <h3 key={i} className="text-xl font-semibold text-foreground mt-8 mb-3">{line.replace('### ', '')}</h3>
              }
              if (line.startsWith('```')) {
                return null
              }
              if (line.startsWith('- ')) {
                return <li key={i} className="ml-4 text-muted-foreground">{line.replace('- ', '')}</li>
              }
              if (line.trim() === '') return <br key={i} />
              if (line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ') || line.startsWith('4. ') || line.startsWith('5. ')) {
                return <li key={i} className="ml-4 text-muted-foreground">{line.replace(/^\d+\.\s/, '')}</li>
              }
              if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="font-semibold text-foreground">{line.replace(/\*\*/g, '')}</p>
              }
              return <p key={i} className="text-muted-foreground leading-relaxed">{line}</p>
            })}
          </div>
        </article>
      </div>
    </PageLayout>
  )
}
