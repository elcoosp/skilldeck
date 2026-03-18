import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mdx from '@astrojs/mdx';
import minisearch from '@barnabask/astro-minisearch';

export default defineConfig({
  site: 'https://docs.skilldeck.dev',
  integrations: [
    mdx(),
    starlight({
      title: 'SkillDeck Documentation',
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: true,
      },
      social: {
        github: 'https://github.com/elcoosp/skilldeck',
        discord: 'https://discord.gg/skilldeck',
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Installation', link: '/getting-started/installation/' },
            { label: 'First Conversation', link: '/getting-started/first-conversation/' },
            { label: 'First Skill', link: '/getting-started/first-skill/' },
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
        Search: './src/components/Search.astro',
        Head: './src/components/Head.astro',
        Nudge: './src/components/mdx/Nudge.astro',
        Checkpoint: './src/components/mdx/Checkpoint.astro',
        Feedback: './src/components/mdx/Feedback.astro',
      },
      customCss: [
        './src/styles/custom.css',
      ],
    }),
    minisearch(),
  ],
  output: 'static',
});
