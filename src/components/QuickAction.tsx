import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { quickActionLabel } from '../lib/navigation'
import { QuickActionContext, type QuickActionApi } from './quickActionContext'

const GlobalTransactionSheet = lazy(() =>
  import('../modules/finance/GlobalTransactionSheet').then((m) => ({ default: m.GlobalTransactionSheet })),
)

export function QuickActionProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const handlers = useRef<Array<{ id: symbol; run: () => void }>>([])
  const pathnameRef = useRef(pathname)
  // Tocco arrivato prima che la pagina (caricata in modo lazy) registrasse la sua azione.
  const pending = useRef<string | null>(null)
  const [globalMounted, setGlobalMounted] = useState(false)
  const [globalOpen, setGlobalOpen] = useState(false)

  useEffect(() => {
    pathnameRef.current = pathname
    if (pending.current !== pathname) pending.current = null
  }, [pathname])

  const api = useMemo<QuickActionApi>(() => ({
    register(run) {
      const id = Symbol('quick-action')
      handlers.current.push({ id, run })
      if (pending.current === pathnameRef.current) {
        pending.current = null
        queueMicrotask(run)
      }
      return () => {
        handlers.current = handlers.current.filter((handler) => handler.id !== id)
      }
    },
    trigger() {
      const current = handlers.current[handlers.current.length - 1]
      if (current) {
        current.run()
        return
      }
      if (quickActionLabel(pathnameRef.current) !== 'Nuovo movimento') {
        pending.current = pathnameRef.current
        return
      }
      setGlobalMounted(true)
      setGlobalOpen(true)
    },
  }), [])

  return (
    <QuickActionContext.Provider value={api}>
      {children}
      {globalMounted && (
        <Suspense fallback={null}>
          <GlobalTransactionSheet open={globalOpen} onClose={() => setGlobalOpen(false)} />
        </Suspense>
      )}
    </QuickActionContext.Provider>
  )
}
