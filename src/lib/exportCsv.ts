import { supabase } from './supabase'
import type { Category, Transaction } from '../types'

export function csvEscape(value: string): string {
  // Protezione da CSV injection: Excel interpreta =, +, -, @ a inizio cella come formule.
  // Gli importi numerici (es. "-15,85") sono legittimi e non vanno neutralizzati.
  const isNumber = /^-?\d+(,\d+)?$/.test(value)
  const neutralized = !isNumber && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[";\r\n]/.test(neutralized) ? `"${neutralized.replace(/"/g, '""')}"` : neutralized
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
    ['Data', 'Tipo', 'Categoria', 'Descrizione', 'Importo originale', 'Valuta', 'Controvalore (EUR)', 'Cambio a EUR', 'Data cambio', 'Fonte', 'Ricorrenza'],
    ...transactions.map((t) => [
      t.date,
      t.kind === 'income' ? 'Entrata' : 'Uscita',
      t.category_id ? (catById.get(t.category_id) ?? '') : '',
      t.description,
      ((t.kind === 'income' ? 1 : -1) * ((t.original_amount_cents ?? t.amount_cents) / 100)).toFixed(2).replace('.', ','),
      t.currency_code ?? 'EUR',
      ((t.kind === 'income' ? 1 : -1) * (t.amount_cents / 100)).toFixed(2).replace('.', ','),
      String(t.exchange_rate_to_eur ?? 1).replace('.', ','),
      t.exchange_rate_date ?? '',
      t.exchange_rate_source ?? 'EUR',
      t.recurrence ?? '',
    ]),
  ]

  const csv = '﻿' + rows.map((r) => r.map(csvEscape).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `aje-movimenti-${new Date().toISOString().slice(0, 10)}.csv`
  a.hidden = true
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Safari può annullare il download se il Blob URL viene revocato nello stesso tick.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
