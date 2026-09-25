import { describe, expect, it } from 'vitest'
import { MAX_PAD_CENTS, budgetTone, dayGroupLabel, groupByDay, padAppend, padBackspace, sheetDateLabel } from './finance'
import type { Transaction } from '../types'

function tx(partial: Partial<Transaction>): Transaction {
  return { id: crypto.randomUUID(), amount_cents: 0, kind: 'expense', transfer_group: null, date: '2026-09-24', ...partial } as Transaction
}

describe('tastierino', () => {
  it('fa entrare le cifre dai centesimi', () => {
    expect(padAppend(0, '1')).toBe(1)
    expect(padAppend(padAppend(padAppend(0, '1'), '2'), '5')).toBe(125)
    expect(padAppend(125, '0')).toBe(1250)
    expect(padAppend(12, '00')).toBe(1200)
  })

  it('non supera 999.999,99 e ignora i caratteri non numerici', () => {
    expect(padAppend(MAX_PAD_CENTS, '1')).toBe(MAX_PAD_CENTS)
    expect(padAppend(9_999_999, '00')).toBe(99_999_990)
    expect(padAppend(5, 'a')).toBe(5)
  })

  it('cancella l’ultima cifra', () => {
    expect(padBackspace(1250)).toBe(125)
    expect(padBackspace(1)).toBe(0)
    expect(padBackspace(0)).toBe(0)
  })
})

describe('etichette dei giorni', () => {
  it('usa Oggi, Ieri o la data estesa', () => {
    expect(dayGroupLabel('2026-09-24', '2026-09-24')).toBe('Oggi')
    expect(dayGroupLabel('2026-09-23', '2026-09-24')).toBe('Ieri')
    expect(dayGroupLabel('2026-09-22', '2026-09-24')).toBe('22 settembre')
    expect(dayGroupLabel('2026-08-31', '2026-09-01')).toBe('Ieri')
  })

  it('riassume la data nel foglio', () => {
    expect(sheetDateLabel('2026-09-24', '2026-09-24')).toBe('Oggi, 24 set')
    expect(sheetDateLabel('2026-09-20', '2026-09-24')).toBe('20 set')
  })
})

describe('groupByDay', () => {
  it('raggruppa mantenendo l’ordine e calcola il netto senza trasferimenti', () => {
    const groups = groupByDay([
      tx({ date: '2026-09-24', amount_cents: 4680 }),
      tx({ date: '2026-09-24', amount_cents: 10000, kind: 'income' }),
      tx({ date: '2026-09-24', amount_cents: 5000, transfer_group: 'g' }),
      tx({ date: '2026-09-23', amount_cents: 6000 }),
    ])
    expect(groups.map((g) => [g.day, g.items.length, g.net])).toEqual([
      ['2026-09-24', 3, 5320],
      ['2026-09-23', 1, -6000],
    ])
  })
})

describe('budgetTone', () => {
  it('passa ad avviso da 85% e a errore oltre il 100%', () => {
    expect(budgetTone(8400, 10000)).toBe('brand')
    expect(budgetTone(8500, 10000)).toBe('warning')
    expect(budgetTone(10000, 10000)).toBe('warning')
    expect(budgetTone(10001, 10000)).toBe('expense')
  })
})
