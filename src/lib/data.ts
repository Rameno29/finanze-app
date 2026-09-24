import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { monthRange } from './format'
import type { Account, Budget, Category, Goal, Task, Transaction } from '../types'
import { cacheData, currentUserId, readCachedData, overlayPendingRows } from './offline'
import { sessionScope } from './sessionScope'
import { readAllPages } from './pagination'

const DATA_CHANGED = 'aje:data-changed'

/** Avvisa le viste montate che movimenti e saldi sono cambiati fuori da loro (es. dal "+" globale). */
export function notifyDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED))
}

function useDataChanged(reload: () => unknown) {
  useEffect(() => {
    const onChange = () => void reload()
    window.addEventListener(DATA_CHANGED, onChange)
    return () => window.removeEventListener(DATA_CHANGED, onChange)
  }, [reload])
}

async function loadWithOfflineCache<T>(
  collection: string,
  onlineLoad: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const ticket = sessionScope.capture()
  const userId = await currentUserId()
  if (navigator.onLine) {
    try {
      const data = await readAllPages(async (from,to) => {
        sessionScope.assert(ticket)
        const result = await onlineLoad(from,to)
        sessionScope.assert(ticket)
        return result
      })
      const merged = await overlayPendingRows(userId, collection, data)
      sessionScope.assert(ticket)
      await cacheData(userId, collection, merged)
      return merged
    } catch { sessionScope.assert(ticket) }
  }
  const merged = await overlayPendingRows(userId, collection, (await readCachedData<T[]>(userId, collection)) ?? [])
  sessionScope.assert(ticket)
  return merged
}

/** Le spese/entrate ricorrenti attive (il "testimone" della catena di ricorrenza). */
export function useRecurring() {
  const [recurring, setRecurring] = useState<Transaction[]>([])

  const reload = useCallback(async () => {
    const data = await loadWithOfflineCache<Transaction>('recurring', (from,to) => supabase
      .from('transactions').select('*').not('recurrence', 'is', null)
      .order('amount_cents', { ascending: false }).order('id').range(from,to))
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
    const data = await loadWithOfflineCache<Goal>('goals', (from,to) => supabase.from('goals').select('*').order('created_at').order('id').range(from,to))
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
    const data = await loadWithOfflineCache<Task>('tasks', (from,to) => supabase
      .from('tasks')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('due_time', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }).order('id').range(from,to))
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
    const data = await loadWithOfflineCache<Category>('categories', (from,to) => supabase.from('categories').select('*').order('kind').order('name').order('id').range(from,to))
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
    const data = await loadWithOfflineCache<Transaction>(`transactions:${year}-${String(month).padStart(2, '0')}`, (offset,end) => supabase
      .from('transactions')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }).order('id').range(offset,end))
    if (request !== requestSequence.current) return
    setTransactions(data)
    setLoading(false)
  }, [year, month])

  useEffect(() => {
    setLoading(true)
    void reload()
  }, [reload])
  useDataChanged(reload)

  return { transactions, loading, reload }
}

export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const data = await loadWithOfflineCache<Budget>('budgets', (from,to) => supabase.from('budgets').select('*').order('id').range(from,to))
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
    const data = await loadWithOfflineCache<Account>('accounts', (from,to) => supabase
      .from('accounts').select('*').order('created_at').order('id').range(from,to))
    setAccounts(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useDataChanged(reload)

  return { accounts, loading, reload }
}

/**
 * Saldo attuale di ogni conto: saldo iniziale + tutti i movimenti assegnati
 * (trasferimenti inclusi). Chiave = id del conto, valore in centesimi.
 */
export async function fetchAccountBalances(accounts: Account[]): Promise<Map<string, number>> {
  const ticket = sessionScope.capture()
  const userId = await currentUserId()
  // L'id serve alla cache offline per riconciliare le operazioni in coda.
  type Row = Pick<Transaction, 'id' | 'amount_cents' | 'kind' | 'account_id' | 'transfer_group'>
  let data: Row[] | null = null
  if (navigator.onLine) {
    try {
      data = await readAllPages<Row>(async (from,to) => {
        sessionScope.assert(ticket)
        const result = await supabase.from('transactions').select('id, amount_cents, kind, account_id, transfer_group').eq('user_id',userId).not('account_id','is',null).order('id').range(from,to)
        sessionScope.assert(ticket)
        return result
      })
      data = await overlayPendingRows(userId,'account-balances',data)
      sessionScope.assert(ticket)
      await cacheData(userId,'account-balances',data)
    } catch { sessionScope.assert(ticket) }
  }
  data ??= await readCachedData<Row[]>(userId, 'account-balances')
  data = await overlayPendingRows(userId, 'account-balances', data ?? [])
  sessionScope.assert(ticket)

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
  const ticket = sessionScope.capture()
  const userId = await currentUserId()
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1)
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
  type Row = Pick<Transaction, 'id' | 'amount_cents' | 'kind' | 'date' | 'transfer_group'>
  // Old aggregate caches have no IDs and cannot safely reconcile queued deletes.
  const collection = `monthly-totals:v2:${n}`
  let data: Row[] | null = null
  if (navigator.onLine) {
    try {
      data = await readAllPages<Row>(async (offset,to) => {
        sessionScope.assert(ticket)
        const result = await supabase.from('transactions').select('id, amount_cents, kind, date, transfer_group').eq('user_id',userId).gte('date',from).order('id').range(offset,to)
        sessionScope.assert(ticket)
        return result
      })
      data = await overlayPendingRows(userId, collection, data)
      sessionScope.assert(ticket)
      await cacheData(userId, collection, data)
    } catch { sessionScope.assert(ticket) }
  }
  data = await overlayPendingRows(userId, collection, data ?? (await readCachedData<Row[]>(userId, collection)) ?? [])
  sessionScope.assert(ticket)

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
