import { useEffect, useState } from 'react'

const TONES = {
  brand: 'bg-brand',
  warning: 'bg-warning',
  expense: 'bg-expense',
  accent: 'bg-accent',
  income: 'bg-income',
} as const

/**
 * Barra di 8px su `--card-2`. Quando `visible` diventa vero la larghezza parte da 0 e arriva al valore
 * (`duration` e `delay` per lo stagger); poi segue i cambi di valore con la stessa transizione.
 */
export function ProgressBar({
  percent,
  tone = 'brand',
  visible = true,
  delay = 0,
  duration = 900,
  label,
}: {
  percent: number
  tone?: keyof typeof TONES
  visible?: boolean
  delay?: number
  duration?: number
  label?: string
}) {
  const [shown, setShown] = useState(false)
  const [settled, setSettled] = useState(false)
  const clamped = Math.max(0, Math.min(100, percent))

  useEffect(() => {
    if (!visible) {
      setShown(false)
      setSettled(false)
      return
    }
    const frame = requestAnimationFrame(() => setShown(true))
    const timer = window.setTimeout(() => setSettled(true), delay + duration)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [visible, delay, duration])

  return (
    <span
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(clamped) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-hidden={label ? undefined : true}
      className="block h-2 overflow-hidden rounded-[4px] bg-card-2"
    >
      <span
        className={`block h-full rounded-[4px] ${TONES[tone]}`}
        style={{
          width: shown ? `${clamped}%` : '0%',
          transition: `width ${duration}ms var(--ease-standard), background-color 300ms ease`,
          transitionDelay: settled ? '0ms' : `${delay}ms`,
        }}
      />
    </span>
  )
}
