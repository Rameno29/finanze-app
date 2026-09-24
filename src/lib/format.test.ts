import { describe, expect, it } from 'vitest'
import { formatSignedCents, monthRange, parseAmountToCents } from './format'

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

describe('formatSignedCents', () => {
  it('usa il segno meno tipografico seguito da uno spazio per le uscite', () => {
    expect(formatSignedCents(4680, 'expense')).toBe('− 46,80 €')
  })

  it('usa il segno più per le entrate e ignora il segno del valore', () => {
    expect(formatSignedCents(1234500, 'income')).toBe('+ 12.345,00 €')
    expect(formatSignedCents(-1250, 'expense')).toBe('− 12,50 €')
  })
})
