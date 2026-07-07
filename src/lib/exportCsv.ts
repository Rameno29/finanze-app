import { supabase } from './supabase'
import type { Category, Transaction } from '../types'

function csvEscape(value: string): string {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Esporta tutti i movimenti in CSV (separatore ; e virgola decimale, per Excel italiano). */
export async function exportTransactionsCsv(): Promise<boolean> {
  const [txRes, catRes] = await Promise.all([
    supabase.from('transactions').select('*').order('date', { ascending: false }),
    supabase.from('categories').select('*'),
  ])
  const transactions = (txRes.data as Transaction[]) ?? []
  if (transactions.length === 0) return false
  const catById = new Map(((catRes.data as Category[]) ?? []).map((c) => [c.id, c.name]))

  const rows = [
    ['Data', 'Tipo', 'Categoria', 'Descrizione', 'Importo (EUR)', 'Ricorrenza'],
    ...transactions.map((t) => [
      t.date,
      t.kind === 'income' ? 'Entrata' : 'Uscita',
      t.category_id ? (catById.get(t.category_id) ?? '') : '',
      t.description,
      ((t.kind === 'income' ? 1 : -1) * (t.amount_cents / 100)).toFixed(2).replace('.', ','),
      t.recurrence ?? '',
    ]),
  ]

  const csv = '﻿' + rows.map((r) => r.map(csvEscape).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `aje-movimenti-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  return true
}
