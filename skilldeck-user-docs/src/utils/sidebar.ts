import { getCollection } from 'astro:content';

export interface SidebarItem {
  text: string;
  link?: string;
  items?: SidebarItem[];
}

export async function getSidebar(lang: string, version: string, currentPath: string): Promise<SidebarItem[]> {
  const allDocs = await getCollection('docs');
  const filtered = allDocs.filter(doc => doc.id.startsWith(`${lang}/${version}/`));

  const items: SidebarItem[] = [];
  const groups: Record<string, SidebarItem[]> = {};

  for (const doc of filtered) {
    // Remove the 'index.md' special case if needed
    const parts = doc.id.split('/').slice(2); // remove lang/version
    const slug = parts.join('/').replace(/\.mdx?$/, '');
    const title = doc.data.title || slug.split('/').pop() || 'Untitled';

    if (parts.length === 1) {
      // Top-level page (e.g., index.md)
      items.push({ text: title, link: `/${lang}/${version}/${slug}` });
    } else {
      const group = parts[0];
      if (!groups[group]) groups[group] = [];
      groups[group].push({ text: title, link: `/${lang}/${version}/${slug}` });
    }
  }

  // Convert groups to sidebar items
  for (const [groupName, groupItems] of Object.entries(groups)) {
    items.push({
      text: groupName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      items: groupItems,
    });
  }

  return items;
}
