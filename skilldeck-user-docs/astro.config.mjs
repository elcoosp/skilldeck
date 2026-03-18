import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://docs.skilldeck.dev',
  integrations: [
    // ✅ Starlight must come BEFORE mdx so its expressive‑code plugin runs first
    starlight({
      title: 'SkillDeck Documentation',
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: true,
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/elcoosp/skilldeck' },
        { icon: 'discord', label: 'Discord', href: 'https://discord.gg/skilldeck' },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Installation', link: 'getting-started/installation' },
            { label: 'First Conversation', link: 'getting-started/first-conversation' },
            { label: 'First Skill', link: 'getting-started/first-skill' },
          ],
        },
        {
          label: 'Core Concepts',
          autogenerate: { directory: 'concepts' },
        },
        {
          label: 'Tutorials',
          autogenerate: { directory: 'tutorials' },
        },
        {
          label: 'How-to Guides',
          autogenerate: { directory: 'how-to' },
        },
        {
          label: 'Reference',
          autogenerate: { directory: 'reference' },
        },
        {
          label: 'Market Insights',
          autogenerate: { directory: 'market-insights' },
        },
        {
          label: 'Community',
          autogenerate: { directory: 'community' },
        },
      ],
      components: {
        Head: './src/components/Head.astro',
      },
      customCss: ['./src/styles/custom.css'],
    }),
    // ✅ MDX after Starlight – global components still work
    mdx({
      components: {
        Nudge: './src/components/mdx/Nudge.astro',
        Checkpoint: './src/components/mdx/Checkpoint.astro',
        Feedback: './src/components/mdx/Feedback.astro',
      },
    }),
  ],
  output: 'static',
});
