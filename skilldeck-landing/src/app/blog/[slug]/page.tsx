import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PageLayout } from '@/components/shared/PageLayout'
import { getAllBlogSlugs, getBlogPost } from '@/lib/blog'

interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = getAllBlogSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)
  return {
    title: post?.title ?? 'Post Not Found',
    description: post?.excerpt ?? ''
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
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              {post.title}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <time>{post.date}</time>
              <span>by {post.author}</span>
            </div>
          </header>

          <div
            className="prose prose-invert prose-slate max-w-none
            prose-headings:text-foreground prose-headings:font-bold
            prose-h1:text-3xl prose-h1:mt-10 prose-h1:mb-4
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:text-muted-foreground prose-p:leading-relaxed
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-strong:text-foreground prose-strong:font-semibold
            prose-li:text-muted-foreground prose-li:leading-relaxed
            prose-ul:my-4 prose-ul:ml-4 prose-ul:list-disc prose-ul:space-y-2
            prose-ol:my-4 prose-ol:ml-4 prose-ol:list-decimal prose-ol:space-y-2
            prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-[''] prose-code:after:content-[''] prose-code:text-sm
            prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-pre:p-4
            prose-pre:code:bg-transparent prose-pre:code:border-0 prose-pre:code:p-0
            prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:text-muted-foreground prose-blockquote:italic prose-blockquote:my-4 prose-blockquote:pl-4
            prose-hr:border-border prose-hr:my-8
            prose-img:rounded-xl
          "
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {post.content}
            </ReactMarkdown>
          </div>
        </article>
      </div>
    </PageLayout>
  )
}
