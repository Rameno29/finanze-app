import { describe, expect, it } from 'vitest'
import { convertToEurCents, formatCurrencyCents, isCurrencyCode } from './currency'

describe('multivaluta', () => {
  it('converte in centesimi EUR arrotondando una sola volta', () => {
    expect(convertToEurCents(10000, 0.85)).toBe(8500)
    expect(convertToEurCents(1999, 0.912345)).toBe(1824)
  })

  it('rifiuta importi e cambi non validi', () => {
    expect(() => convertToEurCents(0, 1)).toThrow()
    expect(() => convertToEurCents(100, Number.NaN)).toThrow()
    expect(() => convertToEurCents(100, -1)).toThrow()
  })

  it('limita i codici valuta alla lista supportata', () => {
    expect(isCurrencyCode('USD')).toBe(true)
    expect(isCurrencyCode('BTC')).toBe(false)
  })

  it('formatta la valuta originale', () => {
    expect(formatCurrencyCents(12345, 'USD')).toContain('123,45')
  })
})
