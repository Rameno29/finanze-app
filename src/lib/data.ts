import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { monthRange } from './format'
import type { Budget, Category, Transaction } from '../types'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('kind').order('name')
    setCategories((data as Category[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { categories, loading, reload }
}

export function useTransactions(year: number, month: number) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { from, to } = monthRange(year, month)
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setTransactions((data as Transaction[]) ?? [])
    setLoading(false)
  }, [year, month])

  useEffect(() => {
    setLoading(true)
    void reload()
  }, [reload])

  return { transactions, loading, reload }
}

export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { data } = await supabase.from('budgets').select('*')
    setBudgets((data as Budget[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { budgets, loading, reload }
}

/** Totali entrate/uscite (centesimi) di un elenco di transazioni */
export function sumByKind(transactions: Transaction[]) {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    if (t.kind === 'income') income += t.amount_cents
    else expense += t.amount_cents
  }
  return { income, expense, balance: income - expense }
}

/** Entrate/uscite degli ultimi `n` mesi (incluso il corrente) */
export async function fetchMonthlyTotals(n: number) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1)
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
  const { data } = await supabase
    .from('transactions')
    .select('amount_cents, kind, date')
    .gte('date', from)

  const buckets = new Map<string, { income: number; expense: number }>()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1) + i, 1)
    buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, {
      income: 0,
      expense: 0,
    })
  }
  for (const t of (data as Pick<Transaction, 'amount_cents' | 'kind' | 'date'>[]) ?? []) {
    const key = t.date.slice(0, 7)
    const bucket = buckets.get(key)
    if (!bucket) continue
    if (t.kind === 'income') bucket.income += t.amount_cents
    else bucket.expense += t.amount_cents
  }
  return Array.from(buckets.entries()).map(([key, v]) => ({ month: key, ...v }))
}
