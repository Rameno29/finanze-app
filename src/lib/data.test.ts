import { describe, expect, it } from 'vitest'
import { sumByKind } from './data'
import type { Transaction } from '../types'

function tx(kind: Transaction['kind'], amount_cents: number, transfer_group: string | null = null): Transaction {
  return {
    id: crypto.randomUUID(),
    user_id: 'u',
    amount_cents,
    original_amount_cents: amount_cents,
    currency_code: 'EUR',
    exchange_rate_to_eur: 1,
    exchange_rate_date: null,
    exchange_rate_source: 'EUR',
    kind,
    category_id: null,
    date: '2026-07-10',
    description: '',
    recurrence: null,
    document_id: null,
    account_id: null,
    transfer_group,
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

  it('esclude i trasferimenti interni dai totali', () => {
    const group = crypto.randomUUID()
    expect(sumByKind([
      tx('income', 10000),
      tx('expense', 5000, group),
      tx('income', 5000, group),
    ])).toEqual({ income: 10000, expense: 0, balance: 10000 })
  })
})
