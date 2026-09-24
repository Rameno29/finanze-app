import { describe, expect, it } from 'vitest'
import { capitalize, dailyExpenseCents, dayBarHeights, homeTasks, safeToSpend, splitAmount, taskMeta } from './home'
import type { Budget, Task, Transaction } from '../types'

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(), user_id: 'u', amount_cents: 0, currency_code: 'EUR', original_amount_cents: 0,
    kind: 'expense', category_id: null, account_id: null, transfer_group: null, date: '2026-09-01',
    description: '', ...partial,
  } as Transaction
}

function task(partial: Partial<Task>): Task {
  return { id: crypto.randomUUID(), user_id: 'u', title: 't', notes: '', due_date: null, due_time: null, done: false, created_at: '', ...partial }
}

describe('dailyExpenseCents', () => {
  it('somma le uscite per giorno escludendo entrate, trasferimenti e altri mesi', () => {
    const values = dailyExpenseCents([
      tx({ date: '2026-09-03', amount_cents: 500 }),
      tx({ date: '2026-09-03', amount_cents: 250 }),
      tx({ date: '2026-09-03', amount_cents: 9999, kind: 'income' }),
      tx({ date: '2026-09-04', amount_cents: 700, transfer_group: 'g' }),
      tx({ date: '2026-08-31', amount_cents: 100 }),
    ], 2026, 9)
    expect(values).toHaveLength(30)
    expect(values[2]).toBe(750)
    expect(values[3]).toBe(0)
  })
})

describe('dayBarHeights', () => {
  it('scala con la radice quadrata rispetto al massimo, con minimo 4px e giorni futuri fermi', () => {
    const heights = dayBarHeights([400, 100, 0, 900], 3)
    expect(heights).toEqual([104, 52, 4, 4])
  })

  it('senza spese restano tutte al minimo', () => {
    expect(dayBarHeights([0, 0, 0], 2)).toEqual([4, 4, 4])
  })
})

describe('safeToSpend', () => {
  const budgets = [{ category_id: 'food', monthly_cents: 30000 }] as Budget[]

  it('divide il residuo dei budget per i giorni rimasti, oggi incluso', () => {
    const result = safeToSpend(budgets, [tx({ category_id: 'food', amount_cents: 10000 }), tx({ category_id: 'other', amount_cents: 5000 })], 30, 21)
    expect(result).toEqual({ perDay: 2000, remaining: 20000, daysLeft: 10 })
  })

  it('senza budget non mostra nulla e sotto zero resta negativo', () => {
    expect(safeToSpend([], [], 30, 1)).toBeNull()
    expect(safeToSpend(budgets, [tx({ category_id: 'food', amount_cents: 40000 })], 30, 30)?.remaining).toBe(-10000)
  })
})

describe('splitAmount', () => {
  it('separa la parte intera dai decimali', () => {
    expect(splitAmount('8412,60 €')).toEqual({ whole: '8412', fraction: ',60 €' })
    expect(splitAmount('-12,00 €')).toEqual({ whole: '-12', fraction: ',00 €' })
  })
})

describe('taskMeta', () => {
  const today = '2026-09-24'

  it('descrive scadenza e orario', () => {
    expect(taskMeta({ done: false, due_date: today, due_time: '10:00:00' }, today)).toEqual({ text: 'Oggi · 10:00', overdue: false })
    expect(taskMeta({ done: false, due_date: '2026-09-25', due_time: null }, today).text).toBe('Domani')
    expect(taskMeta({ done: false, due_date: '2026-09-26', due_time: '20:30' }, today).text).toBe('sab 26 set · 20:30')
    expect(taskMeta({ done: true, due_date: today, due_time: null }, today).text).toBe('Fatto')
  })

  it('segnala il ritardo', () => {
    expect(taskMeta({ done: false, due_date: '2026-09-23', due_time: null }, today)).toEqual({ text: 'In ritardo · ieri', overdue: true })
    expect(taskMeta({ done: false, due_date: '2026-09-20', due_time: null }, today).text).toBe('In ritardo · 20 set')
  })
})

describe('homeTasks', () => {
  it('tiene le aperte fino a oggi e le completate di oggi o della sessione, in ordine di scadenza', () => {
    const late = task({ id: 'late', due_date: '2026-09-20' })
    const doneToday = task({ id: 'doneToday', due_date: '2026-09-24', done: true })
    const doneOld = task({ id: 'doneOld', due_date: '2026-09-22', done: true })
    const doneNow = task({ id: 'doneNow', due_date: '2026-09-21', done: true })
    const future = task({ id: 'future', due_date: '2026-09-30' })
    const result = homeTasks([doneToday, future, doneOld, late, doneNow], '2026-09-24', new Set(['doneNow']))
    expect(result.map((t) => t.id)).toEqual(['late', 'doneNow', 'doneToday'])
  })
})

describe('capitalize', () => {
  it('rende maiuscola solo la prima lettera', () => {
    expect(capitalize('giovedì 24 settembre')).toBe('Giovedì 24 settembre')
  })
})
