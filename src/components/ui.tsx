import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, X } from 'lucide-react'
import { backFallback, isSecondaryRoute } from '../lib/navigation'

/** Indietro (solo mobile, pagine secondarie): cronologia se c'è, altrimenti risale ad Altro o alla Home. */
function BackButton() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  if (!isSecondaryRoute(pathname)) return null
  return (
    <button
      type="button"
      aria-label="Indietro"
      onClick={() => {
        const index = (window.history.state as { idx?: number } | null)?.idx ?? 0
        if (index > 0) navigate(-1)
        else navigate(backFallback(pathname), { replace: true })
      }}
      className="-ml-2.5 mb-2 flex h-11 w-11 items-center justify-center rounded-full lg:hidden"
    >
      <ArrowLeft className="h-6 w-6" strokeWidth={1.9} />
    </button>
  )
}

/**
 * Intestazione di pagina: titolo sans 34px; su mobile scorre col contenuto, su desktop resta in alto.
 * `narrow` allinea il titolo ai contenuti da 720px (Assistente, Impostazioni, Guida); altrimenti 1120px.
 */
export function PageHeader({
  title,
  subtitle,
  right,
  narrow = false,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  narrow?: boolean
}) {
  return (
    <header className="page-header px-5 pb-2 pt-[calc(env(safe-area-inset-top)+16px)] lg:sticky lg:top-0 lg:z-30 lg:bg-bg lg:px-0 lg:pb-4 lg:pt-8">
      <BackButton />
      <div className={`page-header-inner mx-auto flex w-full items-start justify-between gap-3 lg:px-10 ${narrow ? 'max-w-[720px]' : 'max-w-[1120px]'}`}>
        <div className="min-w-0">
          <h1 className="page-header-title text-[34px] font-semibold leading-[1.1] tracking-[-0.03em]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </div>
    </header>
  )
}

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div style={style} className={`app-card rounded-2xl border border-line bg-card p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-accent ${className}`} />
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

const EMPTY_TONES = {
  muted: 'text-muted',
  accent: 'text-accent',
  brand: 'text-brand',
  expense: 'text-expense',
  warning: 'text-warning',
} as const

export function EmptyState({
  icon,
  title,
  hint,
  tone = 'muted',
  action,
  onAction,
}: {
  icon: ReactNode
  title: string
  hint?: string
  tone?: keyof typeof EMPTY_TONES
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <div className={`mb-1 [&>svg]:h-9 [&>svg]:w-9 ${EMPTY_TONES[tone]}`} aria-hidden="true">{icon}</div>
      <p className="text-xl font-semibold tracking-[-0.01em]">{title}</p>
      {hint && <p className="max-w-[300px] text-sm leading-[1.55] text-muted">{hint}</p>}
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 min-h-12 rounded-[16px] bg-accent px-6 text-[15px] font-semibold text-white transition active:scale-[0.98]"
        >
          {action}
        </button>
      )}
    </div>
  )
}

const SHEET_EXIT_MS = 500
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const FIELDS =
  'input:not([disabled]):not([type="hidden"]):not([type="file"]), select:not([disabled]), textarea:not([disabled])'
/** Fogli aperti, dal più vecchio al più recente: solo l'ultimo risponde a Esc e al focus trap. */
const openSheets: symbol[] = []

function syncSheetState() {
  document.documentElement.classList.toggle('sheet-open', openSheets.length > 0)
}

/**
 * Foglio dal basso su mobile, dialog centrato su desktop. Resta montato per l'animazione di uscita
 * mostrando l'ultimo contenuto visto da aperto.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const [snapshot, setSnapshot] = useState({ title, children, footer })
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Da aperto mostra il contenuto vivo; alla chiusura resta l'ultimo, così l'uscita non si svuota.
  if (open && (snapshot.title !== title || snapshot.children !== children || snapshot.footer !== footer)) {
    setSnapshot({ title, children, footer })
  }
  const view = open ? { title, children, footer } : snapshot

  useEffect(() => {
    if (open) {
      setMounted(true)
      let inner = 0
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true))
      })
      return () => {
        cancelAnimationFrame(outer)
        cancelAnimationFrame(inner)
      }
    }
    setShown(false)
    const timer = window.setTimeout(() => setMounted(false), SHEET_EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    const token = Symbol('sheet')
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const main = document.querySelector<HTMLElement>('.app-main')
    if (main) {
      const top = main.getBoundingClientRect().top
      document.documentElement.style.setProperty('--sheet-origin-y', `${window.innerHeight / 2 - top}px`)
    }
    openSheets.push(token)
    syncSheetState()

    function onKeyDown(event: KeyboardEvent) {
      if (openSheets[openSheets.length - 1] !== token) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      const panel = panelRef.current
      if (event.key !== 'Tab' || !panel) return
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (items.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const focused = document.activeElement
      if (event.shiftKey && (focused === first || !panel.contains(focused))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (focused === last || !panel.contains(focused))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const index = openSheets.indexOf(token)
      if (index >= 0) openSheets.splice(index, 1)
      syncSheetState()
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true })
    }
  }, [open])

  const active = open && mounted
  useEffect(() => {
    if (!active) return
    const panel = panelRef.current
    if (!panel || panel.contains(document.activeElement)) return
    // Su desktop il focus va sul primo campo; su mobile sul foglio, per non aprire la tastiera da sola.
    const desktop = window.matchMedia('(min-width: 1024px)').matches
    const field = desktop ? panel.querySelector<HTMLElement>(FIELDS) : null
    ;(field ?? panel).focus({ preventScroll: true })
  }, [active])

  if (!mounted) return null
  const state = open && shown ? 'open' : 'closed'
  return createPortal(
    <div
      className="sheet-root fixed inset-0 z-50"
      data-state={state}
      style={open ? undefined : { pointerEvents: 'none' }}
    >
      <div className="sheet-backdrop absolute inset-0 bg-black/40" aria-hidden="true" onClick={onClose} />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center lg:items-center lg:p-6">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="sheet-panel pointer-events-auto flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-card shadow-2xl outline-none lg:max-h-[min(760px,92dvh)] lg:w-[460px] lg:rounded-[28px]"
        >
          <div className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 rounded-full bg-line lg:hidden" aria-hidden="true" />
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-3 lg:pt-5">
            <h2 id={titleId} className="min-w-0 text-lg font-semibold leading-tight">{view.title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card-2 text-muted"
            >
              <X className="h-5 w-5" strokeWidth={1.9} />
            </button>
          </div>
          <div
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 ${
              view.footer ? 'pb-4' : 'pb-[calc(env(safe-area-inset-bottom)+20px)] lg:pb-6'
            }`}
          >
            {view.children}
          </div>
          {view.footer && (
            <div className="shrink-0 bg-card px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3 lg:pb-6">
              {view.footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-white transition active:scale-[0.98] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'app-field w-full rounded-xl border border-line bg-card px-4 py-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/15'
