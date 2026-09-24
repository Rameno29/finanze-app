export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Colore pieno dell'indicatore quando l'opzione è attiva (testo bianco). Senza, indicatore `--card`. */
  color?: string
}

/**
 * Controllo a segmenti con indicatore che scorre. `md`: 44px (es. Uscita/Entrata);
 * `sm`: 40px (es. Attività/Calendario, carburanti). I segmenti restano `button` con `aria-pressed`.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  className = '',
}: {
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onChange: (value: T) => void
  label: string
  size?: 'md' | 'sm'
  className?: string
}) {
  const count = options.length
  const index = Math.max(0, options.findIndex((option) => option.value === value))
  const active = options[index]
  const step = `(100% - 8px) / ${count}`

  return (
    <div
      role="group"
      aria-label={label}
      className={`relative grid rounded-[14px] bg-card-2 p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className={`segmented-indicator absolute inset-y-1 rounded-[10px] ${
          active?.color ? '' : 'shadow-[0_1px_3px_rgb(21_44_41/.12)]'
        }`}
        style={{
          width: `calc(${step})`,
          left: `calc(4px + ${step} * ${index})`,
          backgroundColor: active?.color ?? 'var(--card)',
        }}
      />
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`relative z-[1] transition-colors duration-300 ${
              size === 'md' ? 'min-h-11 text-[15px]' : 'min-h-10 text-[13px]'
            } font-semibold ${selected ? (option.color ? 'text-white' : 'text-ink') : 'text-muted'}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
