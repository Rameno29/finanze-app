import { createContext, useContext, useEffect, useRef } from 'react'

export interface QuickActionApi {
  /** Registra l'azione del "+" per la pagina montata; restituisce la funzione di rimozione. */
  register: (run: () => void) => () => void
  /** Esegue l'azione della pagina corrente, oppure apre il foglio "Nuovo movimento" globale. */
  trigger: () => void
}

export const QuickActionContext = createContext<QuickActionApi>({
  register: () => () => {},
  trigger: () => {},
})

export function useQuickActionTrigger() {
  return useContext(QuickActionContext).trigger
}

/** La pagina che usa questo hook decide cosa fa il "+" (barra mobile e CTA della sidebar). */
export function useQuickAction(run: () => void) {
  const { register } = useContext(QuickActionContext)
  const latest = useRef(run)
  useEffect(() => {
    latest.current = run
  })
  useEffect(() => register(() => latest.current()), [register])
}
