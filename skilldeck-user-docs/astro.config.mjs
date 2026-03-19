import mdx from '@astrojs/mdx'
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import { buildSidebarItems } from './src/utils/versions'
export default defineConfig({
  site: 'https://docs.skilldeck.dev',
  integrations: [
    starlight({
      title: 'SkillDeck Documentation',
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: true
      },
      editLink: {
        baseUrl:
          'https://github.com/elcoosp/skilldeck/edit/main/skilldeck-user-docs/'
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/elcoosp/skilldeck'
        },
        {
          icon: 'discord',
          label: 'Discord',
          href: 'https://discord.gg/skilldeck'
        }
      ],
      defaultLocale: 'en',
      locales: {
        en: { label: 'English', lang: 'en' },
        fr: { label: 'Français', lang: 'fr' }
      },
      sidebar: buildSidebarItems(),
      components: {
        Head: './src/components/Head.astro',
        Header: './src/components/Header.astro'
      },
      customCss: ['./src/styles/custom.css']
    }),
    mdx({
      components: {
        Nudge: './src/components/mdx/Nudge.astro',
        Checkpoint: './src/components/mdx/Checkpoint.astro',
        Feedback: './src/components/mdx/Feedback.astro'
      }
    })
  ],
  output: 'static'
})
