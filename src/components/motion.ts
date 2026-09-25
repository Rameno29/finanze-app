import { useEffect, useRef, useState } from 'react'

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Numero che scorre dal valore precedente al nuovo (easeOutCubic, requestAnimationFrame).
 * Finché `ready` è falso (primo caricamento) salta direttamente al valore, senza animare.
 */
export function useAnimatedNumber(target: number, ready: boolean, { delay = 450, duration = 900 } = {}) {
  const [value, setValue] = useState(target)
  const current = useRef(target)
  const primed = useRef(false)

  useEffect(() => {
    const from = current.current
    if (!primed.current || prefersReducedMotion()) {
      current.current = target
      setValue(target)
      if (ready) primed.current = true
      return
    }
    if (from === target) return
    let frame = 0
    const start = performance.now() + delay
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / duration))
      const eased = 1 - (1 - progress) ** 3
      const next = Math.round(from + (target - from) * eased)
      current.current = next
      setValue(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, ready, delay, duration])

  return value
}

/**
 * Id comparsi dopo il primo caricamento (es. una riga appena salvata): servono ad aprirla evidenziata.
 * Gli id già presenti al primo caricamento non contano; cambiando `scope` (es. il mese) si riparte da zero.
 */
export function useNewIds(ids: readonly string[], ready: boolean, scope = ''): ReadonlySet<string> {
  const known = useRef<Set<string> | null>(null)
  const knownScope = useRef(scope)
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set())
  const key = ids.join('|')

  useEffect(() => {
    if (knownScope.current !== scope) {
      knownScope.current = scope
      known.current = null
      setFresh(new Set())
    }
    if (!ready) return
    const list = key ? key.split('|') : []
    if (known.current === null) {
      known.current = new Set(list)
      return
    }
    const seen = known.current
    const added = list.filter((id) => !seen.has(id))
    for (const id of list) seen.add(id)
    if (added.length > 0) setFresh(new Set(added))
  }, [key, ready, scope])

  return fresh
}
