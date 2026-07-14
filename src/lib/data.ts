import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { monthRange } from './format'
import type { Account, Budget, Category, Goal, Task, Transaction } from '../types'
import { cacheData, currentUserId, readCachedData } from './offline'

async function loadWithOfflineCache<T>(
  collection: string,
  onlineLoad: () => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const userId = await currentUserId()
  if (navigator.onLine) {
    const { data, error } = await onlineLoad()
    if (!error && data) {
      await cacheData(userId, collection, data)
      return data
    }
  }
  return (await readCachedData<T[]>(userId, collection)) ?? []
}

/** Le spese/entrate ricorrenti attive (il "testimone" della catena di ricorrenza). */
export function useRecurring() {
  const [recurring, setRecurring] = useState<Transaction[]>([])

  const reload = useCallback(async () => {
    const data = await loadWithOfflineCache<Transaction>('recurring', () => supabase
      .from('transactions').select('*').not('recurrence', 'is', null)
      .order('amount_cents', { ascending: false }))
    setRecurring(data)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { recurring, reload }
}

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const data = await loadWithOfflineCache<Goal>('goals', () => supabase.from('goals').select('*').order('created_at'))
    setGoals(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { goals, loading, reload }
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const data = await loadWithOfflineCache<Task>('tasks', () => supabase
      .from('tasks')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('due_time', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }))
    setTasks(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { tasks, loading, reload }
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const data = await loadWithOfflineCache<Category>('categories', () => supabase.from('categories').select('*').order('kind').order('name'))
    setCategories(data)
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
  const requestSequence = useRef(0)

  const reload = useCallback(async () => {
    const request = ++requestSequence.current
    const { from, to } = monthRange(year, month)
    const data = await loadWithOfflineCache<Transaction>(`transactions:${year}-${String(month).padStart(2, '0')}`, () => supabase
      .from('transactions')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }))
    if (request !== requestSequence.current) return
    setTransactions(data)
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
    const data = await loadWithOfflineCache<Budget>('budgets', () => supabase.from('budgets').select('*'))
    setBudgets(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { budgets, loading, reload }
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const data = await loadWithOfflineCache<Account>('accounts', () => supabase
      .from('accounts').select('*').order('created_at'))
    setAccounts(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { accounts, loading, reload }
}

/**
 * Saldo attuale di ogni conto: saldo iniziale + tutti i movimenti assegnati
 * (trasferimenti inclusi). Chiave = id del conto, valore in centesimi.
 */
export async function fetchAccountBalances(accounts: Account[]): Promise<Map<string, number>> {
  const userId = await currentUserId()
  type Row = Pick<Transaction, 'amount_cents' | 'kind' | 'account_id'>
  let data: Row[] | null = null
  if (navigator.onLine) {
    const result = await supabase
      .from('transactions')
      .select('amount_cents, kind, account_id')
      .not('account_id', 'is', null)
    if (!result.error) {
      data = result.data as Row[]
      await cacheData(userId, 'account-balances', data)
    }
  }
  data ??= await readCachedData<Row[]>(userId, 'account-balances')

  const balances = new Map<string, number>(accounts.map((a) => [a.id, a.initial_balance_cents]))
  for (const t of data ?? []) {
    if (!t.account_id || !balances.has(t.account_id)) continue
    const delta = t.kind === 'income' ? t.amount_cents : -t.amount_cents
    balances.set(t.account_id, balances.get(t.account_id)! + delta)
  }
  return balances
}

/**
 * Totali entrate/uscite (centesimi) di un elenco di transazioni.
 * I trasferimenti interni tra conti sono esclusi: non sono né entrate né uscite.
 */
export function sumByKind(transactions: Transaction[]) {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    if (t.transfer_group) continue
    if (t.kind === 'income') income += t.amount_cents
    else expense += t.amount_cents
  }
  return { income, expense, balance: income - expense }
}

/** Entrate/uscite degli ultimi `n` mesi (incluso il corrente) */
export async function fetchMonthlyTotals(n: number) {
  const userId = await currentUserId()
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1)
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
  type Row = Pick<Transaction, 'amount_cents' | 'kind' | 'date' | 'transfer_group'>
  let data: Row[] | null = null
  if (navigator.onLine) {
    const result = await supabase
      .from('transactions')
      .select('amount_cents, kind, date, transfer_group')
      .gte('date', from)
    if (!result.error) {
      data = result.data as Row[]
      await cacheData(userId, `monthly-totals:${n}`, data)
    }
  }
  data ??= await readCachedData(userId, `monthly-totals:${n}`)

  const buckets = new Map<string, { income: number; expense: number }>()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1) + i, 1)
    buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, {
      income: 0,
      expense: 0,
    })
  }
  for (const t of data ?? []) {
    if (t.transfer_group) continue
    const key = t.date.slice(0, 7)
    const bucket = buckets.get(key)
    if (!bucket) continue
    if (t.kind === 'income') bucket.income += t.amount_cents
    else bucket.expense += t.amount_cents
  }
  return Array.from(buckets.entries()).map(([key, v]) => ({ month: key, ...v }))
}
