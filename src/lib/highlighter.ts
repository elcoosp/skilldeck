// src/lib/highlighter.ts
import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

// Dynamic imports – they will be resolved when needed.
const THEMES = {
  'github-light': () => import('@shikijs/themes/github-light'),
  'vitesse-dark': () => import('@shikijs/themes/vitesse-dark'),
}

const LANGUAGES = {
  javascript: () => import('@shikijs/langs/javascript'),
  typescript: () => import('@shikijs/langs/typescript'),
  python: () => import('@shikijs/langs/python'),
  bash: () => import('@shikijs/langs/bash'),
  json: () => import('@shikijs/langs/json'),
  tsx: () => import('@shikijs/langs/tsx'),
  jsx: () => import('@shikijs/langs/jsx'),
  css: () => import('@shikijs/langs/css'),
  html: () => import('@shikijs/langs/html'),
}

let highlighterInstance: HighlighterCore | null = null

export const getHighlighter = async () => {
  if (!highlighterInstance) {
    highlighterInstance = await createHighlighterCore({
      themes: Object.values(THEMES).map(loader => loader()),
      langs: Object.values(LANGUAGES).map(loader => loader()),
      engine: createJavaScriptRegexEngine(),
    })
  }
  return highlighterInstance
}

// Optional: preload immediately (but we'll await it later)
export const preloadHighlighter = () => getHighlighter()
