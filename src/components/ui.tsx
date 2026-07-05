import type { ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-card p-4 shadow-sm ${className}`}>
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

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <div className="text-muted">{icon}</div>
      <p className="font-semibold">{title}</p>
      {hint && <p className="max-w-[260px] text-sm text-muted">{hint}</p>}
    </div>
  )
}

/** Bottom sheet in stile iOS */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Chiudi"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-card pb-safe shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between rounded-t-3xl border-b border-line bg-card px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card-2 text-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
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
  'w-full rounded-xl border border-line bg-card-2 px-4 py-3 outline-none focus:border-accent'
