import { describe, expect, it } from 'vitest'
import { csvEscape } from './exportCsv'

describe('csvEscape', () => {
  it.each(['=1+1', '+CMD', '-cmd', '@SUM(A1)', '\tformula', '\rformula'])(
    'neutralizza formule in %j',
    (value) => expect(csvEscape(value)).toContain(`'${value}`),
  )

  it('non altera un importo negativo legittimo', () => {
    expect(csvEscape('-15,85')).toBe('-15,85')
  })

  it('quota separatori, virgolette e ritorni a capo', () => {
    expect(csvEscape('a;b')).toBe('"a;b"')
    expect(csvEscape('a"b')).toBe('"a""b"')
    expect(csvEscape('a\rb')).toBe('"a\rb"')
  })
})
