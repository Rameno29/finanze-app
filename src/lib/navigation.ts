/** Rotte principali nell'ordine della barra mobile (il "+" occupa la terza colonna). */
export const PRIMARY_ROUTES = ['/', '/finanze', '/agenda', '/documenti'] as const

/** Rotte secondarie: su mobile la barra si nasconde e compare il pulsante indietro. */
export const SECONDARY_ROUTES = ['/altro', '/assistente', '/carburanti', '/impostazioni', '/guida'] as const

/** Colonna della barra mobile (0–4) di ogni rotta principale. */
const BAR_COLUMN: Record<string, number> = { '/': 0, '/finanze': 1, '/agenda': 3, '/documenti': 4 }

export function barColumn(pathname: string): number | null {
  return BAR_COLUMN[pathname] ?? null
}

export function isSecondaryRoute(pathname: string): boolean {
  return (SECONDARY_ROUTES as readonly string[]).includes(pathname)
}

/**
 * Ordine usato per la direzione della transizione di pagina: le rotte della barra da sinistra a destra,
 * poi le secondarie. Le rotte sconosciute mostrano la Home.
 */
export function routeOrder(pathname: string): number {
  const primary = (PRIMARY_ROUTES as readonly string[]).indexOf(pathname)
  if (primary >= 0) return primary
  const secondary = (SECONDARY_ROUTES as readonly string[]).indexOf(pathname)
  return secondary >= 0 ? PRIMARY_ROUTES.length + secondary : 0
}

/** Etichetta (e nome accessibile) del "+" mobile e della CTA della sidebar. */
export function quickActionLabel(pathname: string): string {
  if (pathname === '/agenda') return 'Nuova attività'
  if (pathname === '/documenti') return 'Carica documento'
  return 'Nuovo movimento'
}

/** Pulsante indietro: con cronologia torna alla pagina precedente, altrimenti risale ad Altro o alla Home. */
export function backFallback(pathname: string): string {
  return pathname === '/altro' ? '/' : '/altro'
}
