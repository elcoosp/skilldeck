// src/lib/config.ts
/**
 * Application-wide configuration constants.
 * Centralizes environment-specific values.
 */

export const PLATFORM_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:8080'
  : 'https://platform.skilldeck.dev'

/**
 * Build a full platform URL for a given path.
 * @param path - API path (e.g., '/api/preferences')
 */
export const platformUrl = (path: string) => `${PLATFORM_BASE_URL}${path}`

export const DOCS_LINT_URL = 'https://docs.skilldeck.dev/linting'
