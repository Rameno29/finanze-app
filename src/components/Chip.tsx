import type { ReactNode } from 'react'

/**
 * - `filter`: pill 40px per i filtri (attiva `--text` su `--bg`).
 * - `choice`: scelta con icona, bordo 1.5px (es. categorie nel foglio movimento).
 * - `suggestion`: domanda suggerita all'assistente, 44px su `--accent-soft`.
 */
export type ChipVariant = 'filter' | 'choice' | 'suggestion'

const BASE = 'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors duration-[250ms]'

function variantClass(variant: ChipVariant, selected: boolean) {
  if (variant === 'suggestion') return 'min-h-11 bg-accent-soft px-3.5 text-accent'
  if (variant === 'choice') {
    return `min-h-10 border-[1.5px] pl-2.5 pr-3.5 ${selected ? 'border-ink bg-card-2' : 'border-line'}`
  }
  return `min-h-10 border px-4 ${selected ? 'border-ink bg-ink text-bg' : 'border-line text-ink'}`
}

export function Chip({
  children,
  icon,
  selected,
  onClick,
  variant = 'filter',
  className = '',
}: {
  children: ReactNode
  icon?: ReactNode
  /** Se definito, la chip è un interruttore con `aria-pressed`. */
  selected?: boolean
  onClick?: () => void
  variant?: ChipVariant
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected === undefined ? undefined : selected}
      onClick={onClick}
      className={`${BASE} ${variantClass(variant, Boolean(selected))} ${className}`}
    >
      {icon}
      {children}
    </button>
  )
}
