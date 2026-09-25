import { useMemo, useState, type CSSProperties } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'
import { mutateOffline } from '../../lib/offline'
import { useTasks } from '../../lib/data'
import { MONTH_NAMES, todayISO } from '../../lib/format'
import { taskMeta } from '../../lib/home'
import { agendaSummary, calendarDayLabel, calendarWeeks, groupTasks } from '../../lib/agenda'
import { EmptyState, PageHeader } from '../../components/ui'
import { Segmented } from '../../components/Segmented'
import { SkeletonRow } from '../../components/Skeleton'
import { TaskRow } from '../../components/TaskRow'
import { useNewIds } from '../../components/motion'
import { useIsDesktop } from '../../components/useIsDesktop'
import { TaskSheet } from './TaskSheet'
import { useQuickAction } from '../../components/quickActionContext'
import type { Task } from '../../types'

type View = 'attivita' | 'calendario'

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

export function AgendaPage() {
  const today = todayISO()
  const now = new Date()
  const isDesktop = useIsDesktop()
  const [view, setView] = useState<View>('attivita')
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState(today)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [operationError, setOperationError] = useState('')
  const [completedNow, setCompletedNow] = useState<ReadonlySet<string>>(() => new Set())

  const { tasks, loading, reload } = useTasks()
  const newIds = useNewIds(tasks.map((t) => t.id), !loading)

  // "+" della barra e CTA della sidebar: nuova attività
  useQuickAction(() => {
    setEditing(null)
    setSheetOpen(true)
  })

  async function toggleTask(t: Task) {
    try {
      await mutateOffline('tasks', 'update', t.id, { done: !t.done }, { ...t, done: !t.done })
      if (!t.done) setCompletedNow((previous) => new Set(previous).add(t.id))
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

  const groups = useMemo(() => groupTasks(tasks, today, completedNow), [tasks, today, completedNow])
  const weeks = useMemo(() => calendarWeeks(calYear, calMonth), [calYear, calMonth])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.due_date) continue
      const list = map.get(t.due_date) ?? []
      list.push(t)
      map.set(t.due_date, list)
    }
    for (const list of map.values()) list.sort((a, b) => (a.due_time ?? '99').localeCompare(b.due_time ?? '99'))
    return map
  }, [tasks])

  const dayTasks = tasksByDay.get(selectedDay) ?? []

  function shiftCalMonth(delta: number) {
    const d = new Date(calYear, calMonth - 1 + delta, 1)
    setCalYear(d.getFullYear())
    setCalMonth(d.getMonth() + 1)
    setSelectedDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }

  function renderRow(t: Task) {
    const meta = taskMeta(t, today)
    const text = t.notes && !t.done ? [meta.text, t.notes].filter(Boolean).join(' · ') : meta.text
    return (
      <TaskRow
        key={t.id}
        title={t.title}
        meta={text || undefined}
        overdue={meta.overdue}
        done={t.done}
        isNew={newIds.has(t.id)}
        onToggle={() => void toggleTask(t)}
        onOpen={() => openEdit(t)}
      />
    )
  }

  const sections: Array<[string, Task[], boolean]> = [
    ['In ritardo', groups.overdue, true],
    ['Oggi', groups.today, false],
    ['Prossimi giorni', groups.upcoming, false],
    ['Senza data', groups.noDate, false],
  ]
  const summary = agendaSummary(groups.openCount, groups.overdueCount)

  function panelProps(key: View) {
    const active = isDesktop || view === key
    return { 'data-active': active, 'aria-hidden': active ? undefined : true, inert: !active }
  }

  const activityPanel = (
    <section className="agenda-panel" aria-label="Attività" {...panelProps('attivita')}>
      {tasks.length === 0 && (
        <EmptyState
          icon={<ClipboardList />}
          tone="brand"
          title="Nessuna attività"
          hint={isDesktop
            ? 'Usa Nuova attività per aggiungere la tua prima attività o promemoria.'
            : 'Tocca il bottone + per aggiungere la tua prima attività o promemoria.'}
        />
      )}
      <div className="flex flex-col gap-[22px]">
        {sections.map(([label, list, danger]) => list.length > 0 && (
          <section key={label} aria-label={label}>
            <h3 className="flex items-baseline justify-between text-[13px] font-semibold">
              <span className={danger ? 'text-expense' : 'text-ink'}>{label}</span>
              <span className="font-normal text-muted">{list.length}</span>
            </h3>
            <div>{list.map(renderRow)}</div>
          </section>
        ))}
        {groups.done.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowDone(!showDone)}
              aria-expanded={showDone}
              className="flex min-h-11 w-full items-center justify-between text-[13px] font-semibold text-muted"
            >
              <span>Completate</span>
              <span className="flex items-center gap-1 font-normal">
                {groups.done.length}
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showDone ? 'rotate-180' : ''}`} strokeWidth={1.9} />
              </span>
            </button>
            {showDone && <div>{groups.done.slice(0, 30).map(renderRow)}</div>}
          </section>
        )}
      </div>
    </section>
  )

  const calendarPanel = (
    <section className="agenda-panel" aria-label="Calendario" {...panelProps('calendario')}>
      <h2 className="mb-2 hidden text-[15px] font-semibold lg:block">Calendario</h2>
      <div className="flex items-center justify-between">
        <span className="text-[17px] font-semibold">{MONTH_NAMES[calMonth - 1]} {calYear}</span>
        <span className="flex">
          <button onClick={() => shiftCalMonth(-1)} aria-label="Mese precedente" className="flex h-11 w-11 items-center justify-center rounded-full">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
          </button>
          <button onClick={() => shiftCalMonth(1)} aria-label="Mese successivo" className="flex h-11 w-11 items-center justify-center rounded-full">
            <ChevronRight className="h-5 w-5" strokeWidth={1.9} />
          </button>
        </span>
      </div>

      <div className="mt-2 grid grid-cols-7 text-center text-xs font-medium text-muted" aria-hidden="true">
        {WEEKDAYS.map((d, i) => <span key={i} className="py-1.5">{d}</span>)}
      </div>
      <div role="grid" aria-label={`${MONTH_NAMES[calMonth - 1]} ${calYear}`}>
        {weeks.map((week, wi) => (
          <div key={wi} role="row" className="grid grid-cols-7">
            {week.map((day, di) => {
              if (!day) return <span key={di} role="gridcell" className="h-[46px]" />
              const hasOpen = (tasksByDay.get(day) ?? []).some((t) => !t.done)
              const selected = day === selectedDay
              const isToday = day === today
              const past = day < today
              return (
                <span key={di} role="gridcell" className="flex h-[46px] justify-center">
                  <button
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    aria-pressed={selected}
                    aria-label={`${calendarDayLabel(day)}${isToday ? ', oggi' : ''}${hasOpen ? ', con attività' : ''}`}
                    className="relative flex h-[46px] w-11 flex-col items-center"
                  >
                    <span
                      className={`tabular flex h-9 w-9 items-center justify-center rounded-full text-[15px] transition-colors duration-[250ms] ${
                        selected
                          ? 'bg-ink font-semibold text-bg'
                          : isToday
                            ? 'font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--accent)]'
                            : past ? 'text-muted' : 'text-ink'
                      }`}
                    >
                      {Number(day.slice(8))}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 h-1 w-1 rounded-full ${hasOpen ? (selected ? 'bg-accent' : 'bg-brand') : 'bg-transparent'}`}
                    />
                  </button>
                </span>
              )
            })}
          </div>
        ))}
      </div>

      <section className="mt-4 border-t border-line pt-4" aria-label="Attività del giorno">
        <h3 className="text-[15px] font-semibold">
          {selectedDay === today ? 'Oggi · ' : ''}{calendarDayLabel(selectedDay)}
        </h3>
        {dayTasks.length === 0 ? (
          <p className="mt-2 text-sm leading-[1.55] text-muted">
            Niente in programma. {isDesktop ? 'Usa Nuova attività' : 'Tocca +'} per aggiungere un’attività a questo giorno.
          </p>
        ) : (
          <div className="mt-1">{dayTasks.map(renderRow)}</div>
        )}
      </section>
    </section>
  )

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle={loading ? undefined : summary}
        right={
          <div className="lg:hidden">
            <Segmented
              label="Vista agenda"
              size="sm"
              value={view}
              onChange={setView}
              className="w-[184px]"
              options={[
                { value: 'attivita', label: 'Attività' },
                { value: 'calendario', label: 'Calendario' },
              ]}
            />
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[1120px] overflow-hidden px-5 pt-4 lg:overflow-visible lg:px-10 lg:pt-2">
        {operationError && (
          <p role="alert" className="mb-4 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{operationError}</p>
        )}
        {loading ? (
          <div className="space-y-1">{[0, 1, 2, 3].map((i) => <SkeletonRow key={i} height={60} />)}</div>
        ) : (
          <div className="agenda-rail" style={{ '--agenda-index': view === 'attivita' ? 0 : 1 } as CSSProperties}>
            {activityPanel}
            {calendarPanel}
          </div>
        )}
      </div>

      <TaskSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={reload}
        editing={editing}
        defaultDate={isDesktop || view === 'calendario' ? selectedDay : today}
      />
    </div>
  )
}
