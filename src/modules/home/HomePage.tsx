import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftRight, ChevronRight, CircleUser } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { Sheet, Spinner } from '../../components/ui'
import { Chip } from '../../components/Chip'
import { Skeleton } from '../../components/Skeleton'
import { TaskRow } from '../../components/TaskRow'
import { TransactionRow } from '../../components/TransactionRow'
import { ThemeToggle } from '../../components/TabBar'
import { useAnimatedNumber, useNewIds } from '../../components/motion'
import { AiText } from '../../components/AiText'
import { InstallBanner } from '../../components/InstallBanner'
import {
  fetchAccountBalances,
  sumByKind,
  useAccounts,
  useBudgets,
  useCategories,
  useGoals,
  useTasks,
  useTransactions,
} from '../../lib/data'
import { MONTH_NAMES, formatCents, formatSignedCents, monthLabel, todayISO } from '../../lib/format'
import {
  capitalize,
  dailyExpenseCents,
  dayBarHeights,
  homeTasks,
  safeToSpend as computeSafeToSpend,
  shortDay,
  splitAmount,
  taskMeta,
} from '../../lib/home'
import { invokeFunction } from '../../lib/integrations'
import { mutateOffline } from '../../lib/offline'
import { CategoryIcon } from '../../lib/icons'
import { formatCurrencyCents } from '../../lib/currency'
import type { Task } from '../../types'

const BAR_MAX = 104
const BAR_MIN = 4

function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[15px] font-semibold">{children}</h2>
      {right}
    </div>
  )
}

/** Barre giorno per giorno: altezza ∝ √spesa, giorni futuri fermi, entrata con stagger. */
function DayChart({
  values,
  today,
  selected,
  onSelect,
}: {
  values: number[]
  today: number
  selected: number
  onSelect: (day: number) => void
}) {
  const heights = dayBarHeights(values, today, BAR_MAX, BAR_MIN)
  const [entered, setEntered] = useState(false)
  const [staggerDone, setStaggerDone] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true))
    const timer = window.setTimeout(() => setStaggerDone(true), 700 + values.length * 18)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [values.length])

  const last = values.length
  const ticks = [1, 10, 20, last]
  const columns = { gridTemplateColumns: `repeat(${last}, minmax(0, 1fr))` }

  return (
    <div>
      <div role="group" aria-label="Spesa giorno per giorno" className="grid items-end gap-[3px]" style={{ ...columns, height: BAR_MAX }}>
        {heights.map((height, index) => {
          const day = index + 1
          const future = day > today
          const style = {
            height: entered ? height : 0,
            transitionDelay: staggerDone ? '0ms' : `${index * 18}ms`,
          }
          if (future) {
            return <span key={day} aria-hidden="true" className="day-bar block rounded-[3px] bg-line" style={style} />
          }
          return (
            <button
              key={day}
              type="button"
              aria-label={`Giorno ${day}`}
              aria-pressed={day === selected}
              onClick={() => onSelect(day)}
              className="flex h-full items-end"
            >
              <span
                className={`day-bar block w-full rounded-[3px] ${day === selected ? 'bg-accent' : 'bg-brand'}`}
                style={style}
              />
            </button>
          )
        })}
      </div>
      <div aria-hidden="true" className="mt-1.5 grid gap-[3px] text-[11px] text-muted" style={columns}>
        {ticks.map((tick) => (
          <span key={tick} className="tabular whitespace-nowrap" style={{ gridColumnStart: tick }}>
            {tick}
          </span>
        ))}
      </div>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = todayISO()

  const { transactions, loading } = useTransactions(year, month)
  const { categories } = useCategories()
  const { accounts, loading: accountsLoading } = useAccounts()
  const { tasks, reload: reloadTasks } = useTasks()
  const { budgets } = useBudgets()
  const { goals } = useGoals()
  const [operationError, setOperationError] = useState('')

  // Patrimonio: somma dei saldi dei conti (saldo iniziale + movimenti assegnati)
  const [balances, setBalances] = useState<Map<string, number> | null>(null)
  useEffect(() => {
    if (accountsLoading) return
    let alive = true
    void fetchAccountBalances(accounts)
      .then((result) => { if (alive) setBalances(result) })
      .catch(() => { if (alive) setBalances(new Map()) })
    return () => { alive = false }
  }, [accounts, accountsLoading])
  const netWorth = accounts.reduce((sum, a) => sum + (balances?.get(a.id) ?? a.initial_balance_cents), 0)
  const netWorthReady = !accountsLoading && balances !== null
  const noAccounts = !accountsLoading && accounts.length === 0
  const shownNetWorth = useAnimatedNumber(netWorth, netWorthReady)
  const netWorthParts = splitAmount(formatCents(shownNetWorth))

  const totals = useMemo(() => sumByKind(transactions), [transactions])
  const spendable = useMemo(
    () => computeSafeToSpend(budgets, transactions, daysInMonth, dayOfMonth),
    [budgets, transactions, daysInMonth, dayOfMonth],
  )

  // Grafico del mese
  const daily = useMemo(() => dailyExpenseCents(transactions, year, month), [transactions, year, month])
  const [selectedDay, setSelectedDay] = useState(dayOfMonth)
  const monthName = MONTH_NAMES[month - 1]
  const selectedLabel = selectedDay === dayOfMonth ? 'Oggi' : shortDay(`${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`)

  // Ultimi movimenti
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const latest = transactions.slice(0, 4)
  const newIds = useNewIds(latest.map((t) => t.id), !loading)

  // Da fare oggi
  const [completedNow, setCompletedNow] = useState<ReadonlySet<string>>(() => new Set())
  const dueTasks = useMemo(() => homeTasks(tasks, today, completedNow), [tasks, today, completedNow])

  async function toggleTask(task: Task) {
    try {
      await mutateOffline('tasks', 'update', task.id, { done: !task.done }, { ...task, done: !task.done })
      if (!task.done) setCompletedNow((previous) => new Set(previous).add(task.id))
      setOperationError('')
      void reloadTasks()
    } catch {
      setOperationError('Non riesco ad aggiornare l’attività. Riprova.')
    }
  }

  // Report AI del mese scorso
  const [report, setReport] = useState<string | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const prev = new Date(year, month - 2, 1)
  const prevLabel = monthLabel(prev.getFullYear(), prev.getMonth() + 1)
  const prevMonthName = MONTH_NAMES[prev.getMonth()].toLowerCase()

  async function loadReport() {
    if (reportLoading) return
    setReportLoading(true)
    try {
      const { data, error } = await invokeFunction('ai-analyze', {
        body: {
          mode: 'assistant',
          question:
            `Scrivi il report finanziario di ${prevLabel}: totale entrate e uscite, le 3 categorie di spesa principali, ` +
            `confronto con il mese precedente, budget rispettati o sforati, stato degli obiettivi e 2 consigli pratici per il mese in corso.`,
        },
      })
      if (error) throw error
      setReport((data as { answer: string }).answer)
    } catch {
      setReport('Report non disponibile al momento, riprova tra poco.')
    } finally {
      setReportLoading(false)
    }
  }

  // Domande suggerite: il mese precedente e l'obiettivo sono presi dai dati
  const goal = useMemo(
    () => goals
      .filter((g) => g.saved_cents < g.target_cents)
      .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))[0],
    [goals],
  )

  const pieData = useMemo(() => {
    const byCategory = new Map<string, number>()
    for (const t of transactions) {
      if (t.kind !== 'expense' || t.transfer_group) continue
      const key = t.category_id ?? 'none'
      byCategory.set(key, (byCategory.get(key) ?? 0) + t.amount_cents)
    }
    return Array.from(byCategory.entries())
      .map(([id, value]) => ({
        id,
        name: categoryById.get(id)?.name ?? 'Altro',
        value,
        color: categoryById.get(id)?.color ?? '#71717a',
      }))
      .sort((a, b) => b.value - a.value)
  }, [transactions, categoryById])

  const dateLabel = capitalize(now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }))

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 pt-[calc(env(safe-area-inset-top)+16px)] lg:px-10 lg:pt-8">
      {/* 1. Intestazione */}
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1>
            <img
              src={`${import.meta.env.BASE_URL}aje-wordmark-dark-v2.webp`}
              alt="AJE"
              className="h-6 w-auto dark:brightness-0 dark:invert lg:hidden"
            />
            <span className="hidden text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] lg:inline">Buongiorno</span>
          </h1>
          <p className="mt-1 text-[13px] text-muted">{dateLabel}</p>
        </div>
        <ThemeToggle className="border border-line text-ink" />
        <Link
          to="/altro"
          aria-label="Altro"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand lg:hidden"
        >
          <CircleUser className="h-6 w-6" strokeWidth={1.9} />
        </Link>
      </header>

      <div className="mt-5 empty:hidden lg:hidden">
        <InstallBanner />
      </div>

      {operationError && (
        <p role="alert" className="mt-4 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{operationError}</p>
      )}

      <div className="home-grid mt-7">
        <div className="flex min-w-0 flex-col gap-8">
          {/* 3. Patrimonio */}
          <section aria-label="Patrimonio">
            <p className="text-sm text-muted">
              Patrimonio · {accounts.length} {accounts.length === 1 ? 'conto' : 'conti'}
            </p>
            {netWorthReady ? (
              <p className={`tabular mt-1 text-[58px] font-semibold leading-none tracking-[-0.035em] ${netWorth < 0 ? 'text-expense' : noAccounts ? 'text-muted' : ''}`}>
                {netWorthParts.whole}
                <span className="text-[28px] font-medium tracking-[-0.02em] text-muted">{netWorthParts.fraction}</span>
              </p>
            ) : (
              <Skeleton className="mt-2 h-[58px] w-56 rounded-xl" />
            )}
            <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-income" />
                <span className="tabular">{formatSignedCents(totals.income, 'income')}</span> entrate
              </span>
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-expense" />
                <span className="tabular">{formatSignedCents(totals.expense, 'expense')}</span> uscite
              </span>
            </div>
          </section>

          {/* Home vuota: nessun conto ancora */}
          {noAccounts && (
            <section className="border-y border-line py-6">
              <h2 className="text-xl font-semibold tracking-[-0.01em]">Iniziamo dal tuo conto</h2>
              <p className="mt-1.5 text-sm leading-[1.55] text-muted">
                Aggiungi il conto corrente, una carta o i contanti con il saldo di oggi: da lì AJE calcola patrimonio, spese del giorno e budget.
              </p>
              <button
                type="button"
                onClick={() => navigate('/finanze', { state: { view: 'conti', newAccount: true } })}
                className="mt-4 flex min-h-14 w-full items-center justify-center rounded-[18px] bg-accent text-[16px] font-semibold text-white transition active:scale-[0.98]"
              >
                Aggiungi un conto
              </button>
              <button
                type="button"
                onClick={() => navigate('/finanze', { state: { view: 'conti' } })}
                className="mt-2 flex min-h-11 w-full items-center justify-center text-sm font-semibold text-accent"
              >
                Oppure importa un CSV della banca
              </button>
            </section>
          )}

          {/* 4. Grafico del mese */}
          <section>
            <SectionTitle
              right={
                <span className="tabular text-[13px] text-muted">
                  {selectedLabel} · {formatCents(daily[selectedDay - 1] ?? 0)}
                </span>
              }
            >
              {monthName}, giorno per giorno
            </SectionTitle>
            <DayChart values={daily} today={dayOfMonth} selected={selectedDay} onSelect={setSelectedDay} />
          </section>

          {/* 5. Puoi spendere ancora oggi */}
          {spendable && (
            <section className="flex items-center justify-between gap-4 border-y border-line py-[18px]">
              <div className="min-w-0">
                <p className="text-sm text-muted">Puoi spendere ancora oggi</p>
                {spendable.remaining >= 0 ? (
                  <p className="tabular mt-0.5 text-[26px] font-semibold tracking-[-0.02em] text-income">
                    {formatCents(spendable.perDay)} al giorno
                  </p>
                ) : (
                  <p className="tabular mt-0.5 text-[26px] font-semibold tracking-[-0.02em] text-expense">
                    Hai superato i budget di {formatCents(-spendable.remaining)}
                  </p>
                )}
              </div>
              {spendable.remaining >= 0 && (
                <p className="tabular shrink-0 text-right text-[13px] text-muted">
                  {formatCents(spendable.remaining)} nei budget
                  <br />
                  per {spendable.daysLeft} {spendable.daysLeft === 1 ? 'giorno' : 'giorni'}
                </p>
              )}
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          {/* 6. Ultimi movimenti */}
          <section>
            <SectionTitle right={<Link to="/finanze" className="text-sm font-semibold text-accent">Tutti</Link>}>
              Ultimi movimenti
            </SectionTitle>
            {loading ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : latest.length === 0 ? (
              <p className="py-2 text-sm text-muted">Nessun movimento questo mese. Tocca + per aggiungerne uno.</p>
            ) : (
              <div>
                {latest.map((t) => {
                  const category = t.category_id ? categoryById.get(t.category_id) : undefined
                  const account = t.account_id ? accountById.get(t.account_id) : undefined
                  const transfer = Boolean(t.transfer_group)
                  const subtitle = [transfer ? 'Trasferimento' : (category?.name ?? 'Senza categoria'), account?.name]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <TransactionRow
                      key={t.id}
                      icon={transfer ? <ArrowLeftRight /> : <CategoryIcon icon={category?.icon ?? 'tag'} />}
                      color={transfer ? 'var(--brand)' : (category?.color ?? '#71717a')}
                      title={t.description || category?.name || 'Movimento'}
                      subtitle={subtitle}
                      amountCents={t.amount_cents}
                      kind={t.kind}
                      secondary={t.currency_code && t.currency_code !== 'EUR'
                        ? `${formatCurrencyCents(t.original_amount_cents, t.currency_code)} · BCE`
                        : undefined}
                      isNew={newIds.has(t.id)}
                    />
                  )
                })}
              </div>
            )}
          </section>

          {/* 7. Da fare oggi */}
          {dueTasks.length > 0 && (
            <section>
              <SectionTitle right={<Link to="/agenda" className="text-sm font-semibold text-accent">Agenda</Link>}>
                Da fare oggi
              </SectionTitle>
              <div className="border-t border-line">
                {dueTasks.map((t) => {
                  const meta = taskMeta(t, today)
                  return (
                    <TaskRow
                      key={t.id}
                      title={t.title}
                      meta={meta.text}
                      overdue={meta.overdue}
                      done={t.done}
                      onToggle={() => void toggleTask(t)}
                    />
                  )
                })}
              </div>
            </section>
          )}

          {/* 8. Chiedi ad AJE */}
          <section>
            <SectionTitle>Chiedi ad AJE</SectionTitle>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
              <Chip variant="suggestion" onClick={() => navigate('/assistente', { state: { ask: 'Quanto ho speso in ristoranti?' } })}>
                Quanto ho speso in ristoranti?
              </Chip>
              <Chip variant="suggestion" onClick={() => void loadReport()}>
                {reportLoading ? <Spinner className="h-4 w-4" /> : null}
                Report di {prevMonthName}
              </Chip>
              {goal && (
                <Chip
                  variant="suggestion"
                  onClick={() => navigate('/assistente', { state: { ask: `Posso permettermi ${goal.name}?` } })}
                >
                  Posso permettermi {goal.name}?
                </Chip>
              )}
            </div>
          </section>

          {/* Blocchi esistenti, sotto i suggerimenti */}
          <section>
            <SectionTitle>Uscite per categoria</SectionTitle>
            {loading ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : pieData.length === 0 ? (
              <p className="text-sm text-muted">Nessuna uscita questo mese.</p>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-32 w-32 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2} strokeWidth={0}>
                        {pieData.map((entry) => <Cell key={entry.id} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="min-w-0 flex-1 text-sm">
                  {pieData.slice(0, 5).map((d) => (
                    <li key={d.id} className="flex items-center gap-2 py-1">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="flex-1 truncate">{d.name}</span>
                      <span className="tabular font-semibold">{formatCents(d.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <Link to="/documenti" className="-mt-2 flex min-h-16 items-center gap-3 border-y border-line">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">Carica la busta paga</span>
              <span className="block text-[13px] text-muted">Analisi automatica e stipendio nelle entrate</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.9} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <Sheet open={report !== null} onClose={() => setReport(null)} title={`Report · ${prevLabel}`}>
        <div className="text-sm leading-relaxed">
          <AiText text={report ?? ''} />
        </div>
      </Sheet>
    </div>
  )
}
