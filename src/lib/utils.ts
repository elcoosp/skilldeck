import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Escapes special characters in a string for use in a regular expression.
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Highlights occurrences of `query` in `text` by wrapping them with `<mark>` tags.
 * The mark element will be styled with `background-color: var(--highlight-inline)`.
 * If `query` is empty, returns the original text.
 */
export function highlightText(text: string, query: string): string {
  if (!query || !text) return text
  const escaped = escapeRegExp(query)
  const regex = new RegExp(`(${escaped})`, 'gi')
  return text.replace(
    regex,
    '<mark style="background-color:var(--highlight-inline);color:white;border-radius:2px;padding:0 2px;">$1</mark>'
  )
}
