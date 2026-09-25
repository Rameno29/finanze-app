import { useSyncExternalStore } from 'react'

const DESKTOP_QUERY = '(min-width: 1024px)'

/** Vero da `lg` (1024px) in su: sidebar, griglie affiancate, niente sub-tab. */
export function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(DESKTOP_QUERY)
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
  )
}
