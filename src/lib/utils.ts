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
 *
 * @param text The original text.
 * @param query The search query.
 * @param options.caseSensitive – if true, case-sensitive matching; default false.
 * @param options.isRegex – if true, treat query as a regex; default false.
 * @returns HTML string with <mark> tags.
 */
export function highlightText(
  text: string,
  query: string,
  options?: { caseSensitive?: boolean; isRegex?: boolean }
): string {
  if (!query || !text) return text
  let pattern = query
  if (!options?.isRegex) {
    pattern = escapeRegExp(query)
  }
  const flags = options?.caseSensitive ? 'g' : 'gi'
  let regex: RegExp
  try {
    regex = new RegExp(`(${pattern})`, flags)
  } catch {
    // invalid regex – return plain text
    return text
  }
  return text.replace(
    regex,
    '<mark style="background-color:var(--highlight-inline);color:white;border-radius:2px;padding:0 2px;">$1</mark>'
  )
}
