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
      // We use a dynamic sidebar generated per version/lang, so disable default
      sidebar: [],
      components: {
        Head: './src/components/Head.astro',
        Header: './src/components/Header.astro', // custom header with switchers
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
