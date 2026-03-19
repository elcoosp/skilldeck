import fs from 'node:fs'
import path from 'node:path'

export function getVersionsSync(lang = 'en'): string[] {
  const dir = path.join(process.cwd(), 'src', 'content', 'docs', lang)
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
    // Sort: 'latest' first, then numeric descending (v0-2, v0-1)
    return dirs.sort((a, b) => {
      if (a === 'latest') return -1
      if (b === 'latest') return 1
      const numA = parseInt(a.split('-')[0]?.replace('v', '') || '0', 10)
      const numB = parseInt(b.split('-')[0]?.replace('v', '') || '0', 10)
      return numB - numA
    })
  } catch {
    return []
  }
}

export async function getVersions(lang = 'en'): Promise<string[]> {
  return getVersionsSync(lang)
}

export function formatVersionLabel(dir: string): string {
  if (dir === 'latest') return 'Latest'
  return dir.replace(/-/g, '.')
}

// Build sidebar items for all languages (relative directories)
export function buildSidebarItems(): Array<{
  label: string
  badge?: { text: string; variant: string }
  autogenerate: { directory: string }
  collapsed: boolean
}> {
  const versions = getVersionsSync('en')
  return versions.map((version, index) => ({
    label: formatVersionLabel(version),
    ...(version === 'latest' && { badge: { text: 'current', variant: 'tip' } }),
    autogenerate: { directory: version },
    collapsed: index !== 0
  }))
}
