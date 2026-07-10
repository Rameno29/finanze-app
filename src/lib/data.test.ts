import { describe, expect, it } from 'vitest'
import { sumByKind } from './data'
import type { Transaction } from '../types'

function tx(kind: Transaction['kind'], amount_cents: number): Transaction {
  return {
    id: crypto.randomUUID(),
    user_id: 'u',
    amount_cents,
    kind,
    category_id: null,
    date: '2026-07-10',
    description: '',
    recurrence: null,
    document_id: null,
  }
}

describe('sumByKind', () => {
  it('calcola entrate, uscite e saldo in centesimi', () => {
    expect(sumByKind([tx('income', 10000), tx('expense', 2500), tx('expense', 500)])).toEqual({
      income: 10000,
      expense: 3000,
      balance: 7000,
    })
  })
})
