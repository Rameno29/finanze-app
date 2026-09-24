import { lazy, Suspense, useMemo, useRef, useState, type ReactNode } from 'react'
import { QuickActionContext, type QuickActionApi } from './quickActionContext'

const GlobalTransactionSheet = lazy(() =>
  import('../modules/finance/GlobalTransactionSheet').then((m) => ({ default: m.GlobalTransactionSheet })),
)

export function QuickActionProvider({ children }: { children: ReactNode }) {
  const handlers = useRef<Array<{ id: symbol; run: () => void }>>([])
  const [globalMounted, setGlobalMounted] = useState(false)
  const [globalOpen, setGlobalOpen] = useState(false)

  const api = useMemo<QuickActionApi>(() => ({
    register(run) {
      const id = Symbol('quick-action')
      handlers.current.push({ id, run })
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
