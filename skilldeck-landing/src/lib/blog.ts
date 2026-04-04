import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog')

interface BlogPost {
  slug: string
  title: string
  date: string
  excerpt: string
  author: string
  content: string
}

export function getBlogPosts(): Omit<BlogPost, 'content'>[] {
  if (!fs.existsSync(BLOG_DIR)) return []

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))

  const posts = files.map((filename) => {
    const filePath = path.join(BLOG_DIR, filename)
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const { data } = matter(fileContent)

    return {
      slug: filename.replace(/\.mdx?$/, ''),
      title: (data.title as string) ?? 'Untitled',
      date: (data.date as string) ?? '',
      excerpt: (data.excerpt as string) ?? '',
      author: (data.author as string) ?? 'SkillDeck Team',
    }
  })

  return posts.sort((a, b) => (a.date > b.date ? -1 : 1))
}

export function getBlogPost(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`)
  const fallbackPath = path.join(BLOG_DIR, `${slug}.md`)

  const resolvedPath = fs.existsSync(filePath) ? filePath : fs.existsSync(fallbackPath) ? fallbackPath : null

  if (!resolvedPath) return null

  const fileContent = fs.readFileSync(resolvedPath, 'utf-8')
  const { data, content } = matter(fileContent)

  return {
    slug,
    title: (data.title as string) ?? 'Untitled',
    date: (data.date as string) ?? '',
    excerpt: (data.excerpt as string) ?? '',
    author: (data.author as string) ?? 'SkillDeck Team',
    content,
  }
}

export function getAllBlogSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return []

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
  return files.map((f) => f.replace(/\.mdx?$/, ''))
}
