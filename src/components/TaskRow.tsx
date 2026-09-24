import { Check } from 'lucide-react'

/**
 * Riga attività (60px, bordo inferiore): checkbox tonda 26px, titolo barrato da completato,
 * meta 13px (in `--expense` se in ritardo). `isNew` usa la stessa apertura evidenziata dei movimenti.
 */
export function TaskRow({
  title,
  meta,
  overdue,
  done,
  onToggle,
  onOpen,
  isNew,
}: {
  title: string
  meta?: string
  overdue?: boolean
  done: boolean
  onToggle: () => void
  onOpen?: () => void
  isNew?: boolean
}) {
  const text = (
    <>
      <span className={`block truncate text-[15px] transition-opacity duration-300 ${done ? 'line-through opacity-50' : ''}`}>
        {title}
      </span>
      {meta && (
        <span className={`block truncate text-[13px] ${overdue && !done ? 'text-expense' : 'text-muted'}`}>{meta}</span>
      )}
    </>
  )

  return (
    <div className={`flex min-h-[60px] items-center gap-3.5 border-b border-line ${isNew ? 'row-new' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={done ? 'Segna da fare' : 'Segna completata'}
        aria-pressed={done}
        className="-m-[9px] flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <span
          className={`flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 transition-[background-color,border-color,transform] duration-300 ease-[var(--ease-standard)] ${
            done ? 'scale-[1.08] border-income bg-income text-white' : 'border-line'
          }`}
        >
          {done && <Check className="h-4 w-4" strokeWidth={3} />}
        </span>
      </button>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 py-2 text-left">
          {text}
        </button>
      ) : (
        <div className="min-w-0 flex-1 py-2">{text}</div>
      )}
    </div>
  )
}
