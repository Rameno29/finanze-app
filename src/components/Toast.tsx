import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { CircleCheck } from 'lucide-react'
import { ToastContext, type ToastOptions } from './toastContext'

const VISIBLE_MS = 4200
const EXIT_MS = 400

interface ToastItem extends ToastOptions {
  id: number
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null)
  const [shown, setShown] = useState(false)
  const nextId = useRef(0)
  const removeTimer = useRef<number | null>(null)

  const toast = useCallback((options: ToastOptions) => {
    nextId.current += 1
    setItem({ ...options, id: nextId.current })
  }, [])

  const dismiss = useCallback((id: number) => {
    setShown(false)
    if (removeTimer.current) window.clearTimeout(removeTimer.current)
    removeTimer.current = window.setTimeout(() => {
      setItem((current) => (current?.id === id ? null : current))
    }, EXIT_MS)
  }, [])

  useEffect(() => {
    if (!item) return
    if (removeTimer.current) window.clearTimeout(removeTimer.current)
    setShown(false)
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShown(true))
    })
    const hide = window.setTimeout(() => dismiss(item.id), VISIBLE_MS)
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
      window.clearTimeout(hide)
    }
  }, [item, dismiss])

  useEffect(() => () => {
    if (removeTimer.current) window.clearTimeout(removeTimer.current)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-[60] lg:bottom-6 lg:left-[280px]"
      >
        {item && (
          <div
            key={item.id}
            data-state={shown ? 'open' : 'closed'}
            className="toast pointer-events-auto mx-auto flex max-w-[440px] items-center gap-3 rounded-[18px] bg-ink px-[18px] py-3.5 text-sm text-bg shadow-[var(--shadow-float)]"
          >
            <CircleCheck className="h-5 w-5 shrink-0 text-[#6fe0b0]" strokeWidth={1.9} aria-hidden="true" />
            <span className="min-w-0 flex-1">{item.text}</span>
            {item.onUndo && (
              <button
                type="button"
                onClick={() => {
                  item.onUndo?.()
                  dismiss(item.id)
                }}
                className="-my-2 min-h-11 shrink-0 px-1 font-semibold underline underline-offset-2"
              >
                Annulla
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
