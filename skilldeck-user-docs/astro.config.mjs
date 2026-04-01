import mdx from '@astrojs/mdx'
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

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
      sidebar: [
        {
          label: 'Getting Started',
          translations: { fr: 'Mise en route' },
          autogenerate: { directory: 'getting-started' }
        },
        {
          label: 'How‑To Guides',
          translations: { fr: 'Guides pratiques' },
          items: [
            // Files directly under how-to
            {
              label: 'Install a Skill',
              translations: { fr: 'Installer une compétence' },
              slug: 'how-to/install-a-skill'
            },
            {
              label: 'Configure Profiles',
              translations: { fr: 'Configurer les profils' },
              slug: 'how-to/configure-profiles'
            },
            {
              label: 'Set Up API Keys',
              translations: { fr: 'Configurer les clés API' },
              slug: 'how-to/set-up-api-keys'
            },
            {
              label: 'Use Workspaces',
              translations: { fr: 'Utiliser les espaces de travail' },
              slug: 'how-to/use-workspaces'
            },
            {
              label: 'Configure Lint Rules',
              translations: { fr: 'Configurer les règles de lint' },
              slug: 'how-to/configure-lint-rules'
            },
            {
              label: 'Enable Platform Features',
              translations: {
                fr: 'Activer les fonctionnalités de la plateforme'
              },
              slug: 'how-to/enable-platform-features'
            },
            {
              label: 'Export Conversations',
              translations: { fr: 'Exporter les conversations' },
              slug: 'how-to/export-conversations'
            },
            {
              label: 'Import a Skill from a Gist',
              translations: { fr: 'Importer une compétence depuis un Gist' },
              slug: 'how-to/import-skill-gist'
            },
            {
              label: 'Use the Command Palette',
              translations: { fr: 'Utiliser la palette de commandes' },
              slug: 'how-to/use-command-palette'
            },
            {
              label: 'Manage Queued Messages',
              translations: { fr: 'Gérer les messages en file d’attente' },
              slug: 'how-to/manage-queued-messages'
            },
            {
              label: 'Environment Setup Guide',
              translations: { fr: 'Guide de configuration de l’environnement' },
              slug: 'how-to/environment-setup'
            },
            // Subgroup: Add MCP Server
            {
              label: 'Add an MCP Server',
              translations: { fr: 'Ajouter un serveur MCP' },
              items: [
                {
                  label: 'Filesystem Server',
                  translations: { fr: 'Serveur de système de fichiers' },
                  slug: 'how-to/add-mcp-server/filesystem-server'
                },
                {
                  label: 'Custom stdio Server',
                  translations: { fr: 'Serveur stdio personnalisé' },
                  slug: 'how-to/add-mcp-server/custom-stdio'
                },
                {
                  label: 'Custom SSE Server',
                  translations: { fr: 'Serveur SSE personnalisé' },
                  slug: 'how-to/add-mcp-server/custom-sse'
                }
              ]
            },
            // Subgroup: Troubleshoot
            {
              label: 'Troubleshoot',
              translations: { fr: 'Dépannage' },
              items: [
                {
                  label: 'MCP Connection Issues',
                  translations: { fr: 'Problèmes de connexion MCP' },
                  slug: 'how-to/troubleshoot/mcp-connection'
                },
                {
                  label: 'Skill Not Found',
                  translations: { fr: 'Compétence introuvable' },
                  slug: 'how-to/troubleshoot/skill-not-found'
                },
                {
                  label: 'Agent Not Responding',
                  translations: { fr: 'Agent ne répond pas' },
                  slug: 'how-to/troubleshoot/agent-not-responding'
                }
              ]
            }
          ]
        },
        {
          label: 'Explanations',
          translations: { fr: 'Explications' },
          autogenerate: { directory: 'explanation' }
        },
        {
          label: 'Tutorials',
          translations: { fr: 'Tutoriels' },
          items: [
            // Subgroup: Build a Skill
            {
              label: 'Build a Skill',
              translations: { fr: 'Construire une compétence' },
              items: [
                {
                  label: 'Create Frontmatter',
                  translations: { fr: 'Créer le frontmatter' },
                  slug: 'tutorials/build-a-skill/create-frontmatter'
                },
                {
                  label: 'Write Instructions',
                  translations: { fr: 'Rédiger les instructions' },
                  slug: 'tutorials/build-a-skill/write-instructions'
                },
                {
                  label: 'Test Locally',
                  translations: { fr: 'Tester localement' },
                  slug: 'tutorials/build-a-skill/test-locally'
                },
                {
                  label: 'Share via Gist',
                  translations: { fr: 'Partager via Gist' },
                  slug: 'tutorials/build-a-skill/share-via-gist'
                }
              ]
            },
            // Subgroup: Create a Workflow
            {
              label: 'Create a Workflow',
              translations: { fr: 'Créer un workflow' },
              items: [
                {
                  label: 'Sequential Workflow',
                  translations: { fr: 'Workflow séquentiel' },
                  slug: 'tutorials/create-a-workflow/sequential'
                },
                {
                  label: 'Parallel Workflow',
                  translations: { fr: 'Workflow parallèle' },
                  slug: 'tutorials/create-a-workflow/parallel'
                },
                {
                  label: 'Evaluator‑Optimizer Workflow',
                  translations: { fr: 'Workflow évaluateur‑optimiseur' },
                  slug: 'tutorials/create-a-workflow/evaluator-optimizer'
                }
              ]
            }
          ]
        },
        {
          label: 'Reference',
          translations: { fr: 'Référence' },
          autogenerate: { directory: 'reference' }
        },
        {
          label: 'Community',
          translations: { fr: 'Communauté' },
          autogenerate: { directory: 'community' }
        },
        {
          label: 'Market Insights',
          translations: { fr: 'Aperçus du marché' },
          items: [
            // Subgroup: Agentic Workflows
            {
              label: 'Agentic Workflows',
              translations: { fr: 'Workflows agentiques' },
              items: [
                {
                  label: 'From Chat to Autonomous Systems',
                  translations: { fr: 'Du chat aux systèmes autonomes' },
                  slug: 'market-insights/agentic-workflows/from-chat-to-autonomous'
                },
                {
                  label: 'Workflow Patterns and Anti‑Patterns',
                  translations: { fr: 'Modèles et anti‑modèles de workflows' },
                  slug: 'market-insights/agentic-workflows/patterns-and-anti-patterns'
                },
                {
                  label: 'Case Study: Automating Documentation Generation',
                  translations: {
                    fr: 'Étude de cas : Automatisation de la génération de documentation'
                  },
                  slug: 'market-insights/agentic-workflows/case-study-doc-generation'
                }
              ]
            },
            // Subgroup: Local AI Hub
            {
              label: 'Local AI Hub',
              translations: { fr: 'Hub IA local' },
              items: [
                {
                  label: 'Why Data Privacy Matters',
                  translations: {
                    fr: 'Pourquoi la confidentialité des données est importante'
                  },
                  slug: 'market-insights/local-ai-hub/privacy-by-design'
                },
                {
                  label: 'Local vs. Cloud AI',
                  translations: { fr: 'IA locale vs cloud' },
                  slug: 'market-insights/local-ai-hub/comparison-cloud-vs-local'
                },
                {
                  label: 'Case Study: FinTech Compliance',
                  translations: {
                    fr: 'Étude de cas : Conformité dans la FinTech'
                  },
                  slug: 'market-insights/local-ai-hub/case-study-fintech'
                }
              ]
            },
            // Subgroup: MCP Ecosystem
            {
              label: 'MCP Ecosystem',
              translations: { fr: 'Écosystème MCP' },
              items: [
                {
                  label: 'What is MCP?',
                  translations: { fr: 'Qu’est‑ce que MCP ?' },
                  slug: 'market-insights/mcp-ecosystem/what-is-mcp'
                },
                {
                  label: 'MCP vs. Function Calling',
                  translations: { fr: 'MCP vs appel de fonction' },
                  slug: 'market-insights/mcp-ecosystem/mcp-vs-function-calling'
                },
                {
                  label: 'Ecosystem Directory',
                  translations: { fr: 'Annuaire de l’écosystème' },
                  slug: 'market-insights/mcp-ecosystem/ecosystem-directory'
                }
              ]
            },
            // Direct files under market-insights (if any)
            {
              label: 'Market Insights Overview',
              translations: { fr: 'Aperçu des insights' },
              slug: 'market-insights'
            }
          ]
        }
      ],
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
