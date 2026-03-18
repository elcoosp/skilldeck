import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://docs.skilldeck.dev',
  integrations: [
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
      defaultLocale: 'en',
      locales: {
        en: { label: 'English', lang: 'en' },
        fr: { label: 'Français', lang: 'fr' },
      },
      // Sidebar – version groups with autogenerate relative to locale root
      sidebar: [
        {
          label: 'Latest',
          badge: { text: 'current', variant: 'tip' },
          autogenerate: { directory: 'latest' },
          collapsed: false,
        },
        {
          label: 'v0.2',
          autogenerate: { directory: 'v0.2' },
          collapsed: true,
        },
        {
          label: 'v0.1',
          autogenerate: { directory: 'v0.1' },
          collapsed: true,
        },
      ],
      components: {
        Head: './src/components/Head.astro',
        Header: './src/components/Header.astro',
      },
      customCss: ['./src/styles/custom.css'],
    }),
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
