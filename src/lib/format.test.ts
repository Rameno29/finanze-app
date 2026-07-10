import { describe, expect, it } from 'vitest'
import { monthRange, parseAmountToCents } from './format'

describe('parseAmountToCents', () => {
  it.each([
    ['12', 1200],
    ['12,50', 1250],
    ['12.50', 1250],
    ['1.234', 123400],
    ['1.234,56 €', 123456],
    ['1,234.56', 123456],
    [' 2 345,70 ', 234570],
  ])('converte %s in centesimi', (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected)
  })

  it.each(['', '0', '-1', 'abc', '1,2,3', '1.23.4,56', '12,3456', '12.3456']) (
    'rifiuta il valore non valido %s',
    (input) => expect(parseAmountToCents(input)).toBeNull(),
  )
})

describe('monthRange', () => {
  it('gestisce febbraio bisestile', () => {
    expect(monthRange(2024, 2)).toEqual({ from: '2024-02-01', to: '2024-02-29' })
  })
})
