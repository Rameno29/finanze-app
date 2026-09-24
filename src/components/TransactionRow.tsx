import type { ReactNode } from 'react'
import { formatSignedCents } from '../lib/format'

/**
 * Riga movimento (64px): icona su cerchio del colore categoria al 12%, titolo e "Categoria · Conto",
 * importo con segno. Le uscite restano in `--text`, le entrate in `--income`.
 * `isNew` apre la riga da altezza 0 con evidenziazione `--accent-soft` che sfuma.
 */
export function TransactionRow({
  icon,
  color,
  title,
  subtitle,
  amountCents,
  kind,
  secondary,
  onClick,
  isNew,
}: {
  icon: ReactNode
  /** Colore della categoria (hex o variabile CSS). */
  color: string
  title: string
  subtitle?: string
  amountCents: number
  kind: 'income' | 'expense'
  /** Riga aggiuntiva sotto l'importo, es. importo originale in valuta estera. */
  secondary?: ReactNode
  onClick?: () => void
  isNew?: boolean
}) {
  const content = (
    <>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full [&>svg]:h-5 [&>svg]:w-5"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{title}</span>
        {subtitle && <span className="block truncate text-[13px] text-muted">{subtitle}</span>}
      </span>
      <span className="shrink-0 text-right">
        <span className={`tabular block text-[15px] font-semibold ${kind === 'income' ? 'text-income' : 'text-ink'}`}>
          {formatSignedCents(amountCents, kind)}
        </span>
        {secondary && <span className="tabular block text-[11px] text-muted">{secondary}</span>}
      </span>
    </>
  )
  const rowClass = 'flex min-h-16 w-full items-center gap-3.5 text-left'

  return (
    <div className={`-mx-2.5 rounded-[14px] px-2.5 ${isNew ? 'row-new' : ''}`}>
      {onClick ? (
        <button type="button" onClick={onClick} className={rowClass}>
          {content}
        </button>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </div>
  )
}
