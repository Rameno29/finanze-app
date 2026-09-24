import type { Budget, Task, Transaction } from '../types'

const SHORT_MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const SHORT_WEEKDAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Spesa di ogni giorno del mese (indice 0 = giorno 1), in centesimi; trasferimenti ed entrate esclusi. */
export function dailyExpenseCents(transactions: Transaction[], year: number, month: number): number[] {
  const days = new Date(year, month, 0).getDate()
  const out = new Array<number>(days).fill(0)
  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  for (const t of transactions) {
    if (t.kind !== 'expense' || t.transfer_group || !t.date.startsWith(prefix)) continue
    const day = Number(t.date.slice(8, 10))
    if (day >= 1 && day <= days) out[day - 1] += t.amount_cents
  }
  return out
}

/**
 * Altezza in px di ogni barra: √(spesa) / √(spesa massima) × `max`, minimo `min`.
 * I giorni dopo `today` (1-based) restano fermi a `min`.
 */
export function dayBarHeights(values: number[], today: number, max = 104, min = 4): number[] {
  const peak = Math.max(0, ...values.slice(0, today))
  const root = Math.sqrt(peak)
  return values.map((value, index) => {
    if (index + 1 > today || root === 0) return min
    return Math.max(min, Math.round((Math.sqrt(value) / root) * max))
  })
}

/**
 * "Puoi spendere ancora oggi": (limiti dei budget − speso nelle categorie con budget) ÷ giorni rimasti,
 * oggi incluso. `null` senza budget.
 */
export function safeToSpend(budgets: Budget[], transactions: Transaction[], daysInMonth: number, dayOfMonth: number) {
  if (budgets.length === 0) return null
  const budgeted = new Set(budgets.map((b) => b.category_id))
  const limit = budgets.reduce((sum, b) => sum + b.monthly_cents, 0)
  const spent = transactions
    .filter((t) => t.kind === 'expense' && t.category_id !== null && budgeted.has(t.category_id))
    .reduce((sum, t) => sum + t.amount_cents, 0)
  const daysLeft = Math.max(1, daysInMonth - dayOfMonth + 1)
  const remaining = limit - spent
  return { perDay: Math.round(remaining / daysLeft), remaining, daysLeft }
}

/** "8412,60 €" → { whole: "8412", fraction: ",60 €" } per mostrare i decimali più piccoli. */
export function splitAmount(formatted: string): { whole: string; fraction: string } {
  const comma = formatted.lastIndexOf(',')
  if (comma < 0) return { whole: formatted, fraction: '' }
  return { whole: formatted.slice(0, comma), fraction: formatted.slice(comma) }
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** "12 set" */
export function shortDay(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${SHORT_MONTHS[Number(iso.slice(5, 7)) - 1]}`
}

/** Meta della riga attività: "Oggi · 10:00", "Domani", "sab 26 set · 20:30", "In ritardo · ieri", "Fatto". */
export function taskMeta(task: Pick<Task, 'done' | 'due_date' | 'due_time'>, today: string): { text: string; overdue: boolean } {
  if (task.done) return { text: 'Fatto', overdue: false }
  const time = task.due_time ? task.due_time.slice(0, 5) : ''
  const withTime = (label: string) => (time ? `${label} · ${time}` : label)
  if (!task.due_date) return { text: time, overdue: false }
  if (task.due_date < today) {
    const when = task.due_date === addDays(today, -1) ? 'ieri' : shortDay(task.due_date)
    return { text: `In ritardo · ${when}`, overdue: true }
  }
  if (task.due_date === today) return { text: withTime('Oggi'), overdue: false }
  if (task.due_date === addDays(today, 1)) return { text: withTime('Domani'), overdue: false }
  const weekday = SHORT_WEEKDAYS[new Date(`${task.due_date}T12:00:00`).getDay()]
  return { text: withTime(`${weekday} ${shortDay(task.due_date)}`), overdue: false }
}

/**
 * "Da fare oggi": attività aperte con scadenza fino a oggi, più quelle di oggi già fatte
 * e quelle completate durante la sessione (restano visibili, barrate).
 */
export function homeTasks(tasks: Task[], today: string, completedNow: ReadonlySet<string>): Task[] {
  return tasks
    .filter((t) => t.due_date !== null && t.due_date <= today && (!t.done || t.due_date === today || completedNow.has(t.id)))
    .sort((a, b) =>
      (a.due_date ?? '').localeCompare(b.due_date ?? '') || (a.due_time ?? '99').localeCompare(b.due_time ?? '99'),
    )
}
