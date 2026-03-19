export function trackEvent(
  name: string,
  props?: Record<string, string | number>
) {
  if (typeof window !== 'undefined' && window.plausible) {
    window.plausible(name, { props })
  }
}
