import { describe, expect, it } from 'vitest'
import { DISMISS_DAYS, dismissalActive, isIosDevice } from './install'

describe('installazione PWA', () => {
  const day = 24 * 60 * 60 * 1000

  it('ricorda la chiusura del banner per 30 giorni', () => {
    const now = Date.UTC(2026, 8, 25)
    expect(dismissalActive(null, now)).toBe(false)
    expect(dismissalActive(now - 2 * day, now)).toBe(true)
    expect(dismissalActive(now - DISMISS_DAYS * day, now)).toBe(false)
    expect(dismissalActive(Number.NaN, now)).toBe(false)
    expect(dismissalActive(now + day, now)).toBe(false)
  })

  it('riconosce iPhone e iPad (anche iPadOS che si presenta come Mac)', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 15; Pixel 9)', 5)).toBe(false)
  })
})
