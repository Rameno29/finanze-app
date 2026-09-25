import type { Transaction } from '../types'

/** Importo massimo del tastierino: 999.999,99. */
export const MAX_PAD_CENTS = 99_999_999

/** Tastierino stile POS: ogni cifra entra dai centesimi ("00" aggiunge due zeri). Oltre il massimo non cambia. */
export function padAppend(cents: number, digits: string): number {
  let value = cents
  for (const digit of digits) {
    if (digit < '0' || digit > '9') continue
    const next = value * 10 + Number(digit)
    if (next > MAX_PAD_CENTS) return value
    value = next
  }
  return value
}

/** "⌫": toglie l'ultima cifra inserita. */
export function padBackspace(cents: number): number {
  return Math.floor(cents / 10)
}

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Intestazione del gruppo di movimenti: "Oggi", "Ieri", "22 settembre". */
export function dayGroupLabel(iso: string, today: string): string {
  if (iso === today) return 'Oggi'
  const yesterday = new Date(`${today}T12:00:00`)
  yesterday.setDate(yesterday.getDate() - 1)
  if (iso === isoDay(yesterday)) return 'Ieri'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
}

/** "Oggi, 24 set" per la riga meta del foglio movimento. */
export function sheetDateLabel(iso: string, today: string): string {
  const short = new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')
  const label = dayGroupLabel(iso, today)
  return label === 'Oggi' || label === 'Ieri' ? `${label}, ${short}` : short
}

/** Movimenti raggruppati per giorno (nell'ordine ricevuto) con il netto del giorno, trasferimenti esclusi. */
export function groupByDay(transactions: Transaction[]): Array<{ day: string; items: Transaction[]; net: number }> {
  const groups = new Map<string, { day: string; items: Transaction[]; net: number }>()
  for (const t of transactions) {
    const group = groups.get(t.date) ?? { day: t.date, items: [], net: 0 }
    group.items.push(t)
    if (!t.transfer_group) group.net += t.kind === 'income' ? t.amount_cents : -t.amount_cents
    groups.set(t.date, group)
  }
  return Array.from(groups.values())
}

/** Colore della barra budget: normale, `--warning` da 85%, `--expense` oltre il 100%. */
export function budgetTone(spent: number, limit: number): 'brand' | 'warning' | 'expense' {
  if (limit <= 0 || spent > limit) return 'expense'
  return spent / limit >= 0.85 ? 'warning' : 'brand'
}
