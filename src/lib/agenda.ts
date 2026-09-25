import type { Task } from '../types'
import { shortDay } from './home'

const WEEKDAY_NAMES = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
const SHORT_WEEKDAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function at(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

export function addDaysIso(iso: string, days: number): string {
  const date = at(iso)
  date.setDate(date.getDate() + days)
  return toIso(date)
}

/** Il prossimo sabato dopo oggi (se oggi è sabato, quello della settimana dopo). */
export function nextSaturday(today: string): string {
  const day = at(today).getDay()
  return addDaysIso(today, ((6 - day + 7) % 7) || 7)
}

/** Per il toast: "oggi", "domani", "sabato 26 set", "senza data". */
export function whenLabel(date: string | null, today: string): string {
  if (!date) return 'senza data'
  if (date === today) return 'oggi'
  if (date === addDaysIso(today, 1)) return 'domani'
  return `${WEEKDAY_NAMES[at(date).getDay()]} ${shortDay(date)}`
}

/** "gio 24 settembre" per l'intestazione del giorno nel calendario. */
export function calendarDayLabel(date: string): string {
  const d = at(date)
  return `${SHORT_WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** Settimane del mese con lunedì come primo giorno; `null` per le celle vuote. */
export function calendarWeeks(year: number, month: number): Array<Array<string | null>> {
  const first = new Date(year, month - 1, 1)
  const offset = (first.getDay() + 6) % 7
  const days = new Date(year, month, 0).getDate()
  const cells: Array<string | null> = Array.from({ length: offset }, () => null)
  for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: Array<Array<string | null>> = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

function byDueThenTime(a: Task, b: Task) {
  return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || (a.due_time ?? '99').localeCompare(b.due_time ?? '99')
}

export interface TaskGroups {
  overdue: Task[]
  today: Task[]
  upcoming: Task[]
  noDate: Task[]
  /** Completate prima di questa sessione (sezione richiudibile). */
  done: Task[]
  openCount: number
  overdueCount: number
}

/**
 * Gruppi dell'elenco attività. Quelle completate durante la sessione restano nel loro gruppo, barrate;
 * le altre completate finiscono in `done`.
 */
export function groupTasks(tasks: Task[], today: string, completedNow: ReadonlySet<string>): TaskGroups {
  const visible = tasks.filter((t) => !t.done || completedNow.has(t.id)).sort(byDueThenTime)
  const overdue = visible.filter((t) => t.due_date !== null && t.due_date < today)
  return {
    overdue,
    today: visible.filter((t) => t.due_date === today),
    upcoming: visible.filter((t) => t.due_date !== null && t.due_date > today),
    noDate: visible.filter((t) => t.due_date === null),
    done: tasks.filter((t) => t.done && !completedNow.has(t.id)),
    openCount: tasks.filter((t) => !t.done).length,
    overdueCount: overdue.filter((t) => !t.done).length,
  }
}

/** "6 da fare · 1 in ritardo" */
export function agendaSummary(openCount: number, overdueCount: number): string {
  const parts = [`${openCount} da fare`]
  if (overdueCount > 0) parts.push(`${overdueCount} in ritardo`)
  return parts.join(' · ')
}
