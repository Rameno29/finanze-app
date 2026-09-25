import { describe, expect, it } from 'vitest'
import { agendaSummary, calendarDayLabel, calendarWeeks, groupTasks, nextSaturday, whenLabel } from './agenda'
import type { Task } from '../types'

function task(partial: Partial<Task>): Task {
  return { id: crypto.randomUUID(), user_id: 'u', title: 't', notes: '', due_date: null, due_time: null, done: false, created_at: '', ...partial }
}

describe('date rapide', () => {
  it('trova il prossimo sabato', () => {
    expect(nextSaturday('2026-09-24')).toBe('2026-09-26') // giovedì
    expect(nextSaturday('2026-09-26')).toBe('2026-10-03') // sabato → settimana dopo
    expect(nextSaturday('2026-09-27')).toBe('2026-10-03') // domenica
  })

  it('descrive la scadenza per il toast', () => {
    expect(whenLabel('2026-09-24', '2026-09-24')).toBe('oggi')
    expect(whenLabel('2026-09-25', '2026-09-24')).toBe('domani')
    expect(whenLabel('2026-09-26', '2026-09-24')).toBe('sabato 26 set')
    expect(whenLabel(null, '2026-09-24')).toBe('senza data')
  })

  it('intesta il giorno del calendario', () => {
    expect(calendarDayLabel('2026-09-24')).toBe('gio 24 settembre')
  })
})

describe('calendarWeeks', () => {
  it('parte da lunedì e completa le settimane', () => {
    const weeks = calendarWeeks(2026, 9) // 1 settembre 2026 è martedì
    expect(weeks[0]).toEqual([null, '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'])
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks.flat().filter(Boolean)).toHaveLength(30)
  })
})

describe('groupTasks', () => {
  it('divide per scadenza, ordina per data e ora e tiene visibili le completate della sessione', () => {
    const today = '2026-09-24'
    const late = task({ id: 'late', due_date: '2026-09-23' })
    const lateDoneNow = task({ id: 'lateDoneNow', due_date: '2026-09-20', done: true })
    const todayLater = task({ id: 'todayLater', due_date: today, due_time: '15:30' })
    const todayEarly = task({ id: 'todayEarly', due_date: today, due_time: '09:00' })
    const next = task({ id: 'next', due_date: '2026-09-25' })
    const free = task({ id: 'free' })
    const oldDone = task({ id: 'oldDone', due_date: '2026-09-01', done: true })
    const groups = groupTasks([next, todayLater, free, late, oldDone, todayEarly, lateDoneNow], today, new Set(['lateDoneNow']))
    expect(groups.overdue.map((t) => t.id)).toEqual(['lateDoneNow', 'late'])
    expect(groups.today.map((t) => t.id)).toEqual(['todayEarly', 'todayLater'])
    expect(groups.upcoming.map((t) => t.id)).toEqual(['next'])
    expect(groups.noDate.map((t) => t.id)).toEqual(['free'])
    expect(groups.done.map((t) => t.id)).toEqual(['oldDone'])
    expect([groups.openCount, groups.overdueCount]).toEqual([5, 1])
  })

  it('riassume le attività da fare', () => {
    expect(agendaSummary(6, 1)).toBe('6 da fare · 1 in ritardo')
    expect(agendaSummary(2, 0)).toBe('2 da fare')
  })
})
