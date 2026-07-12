import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, ClipboardList, Plus } from 'lucide-react'
import { mutateOffline } from '../../lib/offline'
import { useTasks } from '../../lib/data'
import { MONTH_NAMES, formatDay, todayISO } from '../../lib/format'
import { Card, EmptyState, PageHeader, Spinner } from '../../components/ui'
import { TaskSheet } from './TaskSheet'
import type { Task } from '../../types'

type View = 'attivita' | 'calendario'

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

function TaskRow({
  task,
  onToggle,
  onEdit,
  showDate,
}: {
  task: Task
  onToggle: (t: Task) => void
  onEdit: (t: Task) => void
  showDate?: boolean
}) {
  const overdue = !task.done && task.due_date !== null && task.due_date < todayISO()
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={() => onToggle(task)}
        aria-label={task.done ? 'Segna da fare' : 'Segna completata'}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
          task.done ? 'border-income bg-income text-white' : 'border-line'
        }`}
      >
        {task.done && <Check className="h-4 w-4" strokeWidth={3} />}
      </button>
      <button onClick={() => onEdit(task)} className="min-w-0 flex-1 text-left">
        <span className={`block truncate font-medium ${task.done ? 'text-muted line-through' : ''}`}>
          {task.title}
        </span>
        {(task.due_time || task.notes || (showDate && task.due_date)) && (
          <span className={`block truncate text-xs ${overdue ? 'text-expense' : 'text-muted'}`}>
            {showDate && task.due_date ? `${formatDay(task.due_date)} ` : ''}
            {task.due_time ? `ore ${task.due_time.slice(0, 5)}` : ''}
            {task.notes && (task.due_time || (showDate && task.due_date)) ? ' · ' : ''}
            {task.notes}
          </span>
        )}
      </button>
    </div>
  )
}

export function AgendaPage() {
  const today = todayISO()
  const now = new Date()
  const [view, setView] = useState<View>('attivita')
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState(today)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [operationError, setOperationError] = useState('')

  const { tasks, loading, reload } = useTasks()

  async function toggleTask(t: Task) {
    try {
      await mutateOffline('tasks', 'update', t.id, { done: !t.done }, { ...t, done: !t.done })
      setOperationError('')
      void reload()
    } catch {
      setOperationError('Aggiornamento non riuscito, controlla la connessione.')
    }
  }

  function openEdit(t: Task) {
    setEditing(t)
    setSheetOpen(true)
  }

  const groups = useMemo(() => {
    const open = tasks.filter((t) => !t.done)
    return {
      overdue: open.filter((t) => t.due_date !== null && t.due_date < today),
      today: open.filter((t) => t.due_date === today),
      upcoming: open.filter((t) => t.due_date !== null && t.due_date > today),
      noDate: open.filter((t) => t.due_date === null),
      done: tasks.filter((t) => t.done),
    }
  }, [tasks, today])

  // Griglia del mese: settimane che iniziano di lunedì
  const weeks = useMemo(() => {
    const first = new Date(calYear, calMonth - 1, 1)
    const startOffset = (first.getDay() + 6) % 7
    const daysInMonth = new Date(calYear, calMonth, 0).getDate()
    const cells: Array<string | null> = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
    while (cells.length % 7 !== 0) cells.push(null)
    const out: Array<Array<string | null>> = []
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7))
    return out
  }, [calYear, calMonth])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.due_date) continue
      const list = map.get(t.due_date) ?? []
      list.push(t)
      map.set(t.due_date, list)
    }
    return map
  }, [tasks])

  const dayTasks = tasksByDay.get(selectedDay) ?? []

  function shiftCalMonth(delta: number) {
    const d = new Date(calYear, calMonth - 1 + delta, 1)
    setCalYear(d.getFullYear())
    setCalMonth(d.getMonth() + 1)
    setSelectedDay(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
    )
  }

  const sections: Array<[string, Task[], boolean]> = [
    ['In ritardo', groups.overdue, true],
    ['Oggi', groups.today, false],
    ['Prossime', groups.upcoming, false],
    ['Senza data', groups.noDate, false],
  ]

  return (
    <div className="pb-28">
      <PageHeader title="Agenda" />

      <div className="mx-auto max-w-lg px-5">
        {operationError && (
          <p className="mt-4 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{operationError}</p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-card-2 p-1">
          {(
            [
              ['attivita', 'Attività'],
              ['calendario', 'Calendario'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`min-h-[40px] rounded-lg text-sm font-semibold transition ${
                view === key ? 'bg-card shadow text-ink' : 'text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : view === 'attivita' ? (
          <>
            {tasks.length === 0 && (
              <EmptyState
                icon={<ClipboardList className="h-10 w-10" />}
                title="Nessuna attività"
                hint="Tocca il bottone + per aggiungere la tua prima attività o promemoria."
              />
            )}
            {sections.map(
              ([label, list, danger]) =>
                list.length > 0 && (
                  <section key={label} className="mt-5">
                    <h3 className={`mb-2 text-sm font-semibold ${danger ? 'text-expense' : 'text-muted'}`}>
                      {label} · {list.length}
                    </h3>
                    <Card className="divide-y divide-line p-0">
                      {list.map((t) => (
                        <TaskRow key={t.id} task={t} onToggle={toggleTask} onEdit={openEdit} showDate />
                      ))}
                    </Card>
                  </section>
                ),
            )}
            {groups.done.length > 0 && (
              <section className="mt-5">
                <button
                  onClick={() => setShowDone(!showDone)}
                  className="mb-2 text-sm font-semibold text-muted"
                >
                  Completate · {groups.done.length} {showDone ? '▾' : '▸'}
                </button>
                {showDone && (
                  <Card className="divide-y divide-line p-0">
                    {groups.done.slice(0, 30).map((t) => (
                      <TaskRow key={t.id} task={t} onToggle={toggleTask} onEdit={openEdit} showDate />
                    ))}
                  </Card>
                )}
              </section>
            )}
          </>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => shiftCalMonth(-1)}
                aria-label="Mese precedente"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-card-2"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="font-semibold">
                {MONTH_NAMES[calMonth - 1]} {calYear}
              </span>
              <button
                onClick={() => shiftCalMonth(1)}
                aria-label="Mese successivo"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-card-2"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <Card className="mt-3 p-3">
              <div className="mb-1 grid grid-cols-7 text-center text-xs font-semibold text-muted">
                {WEEKDAYS.map((d, i) => (
                  <span key={i} className="py-1">
                    {d}
                  </span>
                ))}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7">
                  {week.map((day, di) => {
                    if (!day) return <span key={di} />
                    const has = (tasksByDay.get(day) ?? []).some((t) => !t.done)
                    const isSelected = day === selectedDay
                    const isToday = day === today
                    return (
                      <button
                        key={di}
                        onClick={() => setSelectedDay(day)}
                        className={`mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-full text-sm transition ${
                          isSelected
                            ? 'bg-accent font-bold text-white'
                            : isToday
                              ? 'font-bold text-accent'
                              : ''
                        }`}
                      >
                        {Number(day.slice(8))}
                        <span
                          className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                            has ? (isSelected ? 'bg-white' : 'bg-accent') : 'bg-transparent'
                          }`}
                        />
                      </button>
                    )
                  })}
                </div>
              ))}
            </Card>

            <section className="mt-5">
              <h3 className="mb-2 text-sm font-semibold capitalize text-muted">{formatDay(selectedDay)}</h3>
              {dayTasks.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                  Nessuna attività in questo giorno.
                </p>
              ) : (
                <Card className="divide-y divide-line p-0">
                  {dayTasks.map((t) => (
                    <TaskRow key={t.id} task={t} onToggle={toggleTask} onEdit={openEdit} />
                  ))}
                </Card>
              )}
            </section>
          </>
        )}
      </div>

      <button
        onClick={() => {
          setEditing(null)
          setSheetOpen(true)
        }}
        aria-label="Nuova attività"
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-xl transition active:scale-95"
      >
        <Plus className="h-7 w-7" />
      </button>

      <TaskSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={reload}
        editing={editing}
        defaultDate={view === 'calendario' ? selectedDay : today}
      />
    </div>
  )
}
