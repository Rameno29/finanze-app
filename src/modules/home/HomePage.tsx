import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
} from 'recharts'
import { Card, Spinner } from '../../components/ui'
import {
  fetchMonthlyTotals,
  sumByKind,
  useBudgets,
  useCategories,
  useTasks,
  useTransactions,
} from '../../lib/data'
import { MONTH_NAMES, formatCents, monthLabel, todayISO } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Bot, Check, Euro } from 'lucide-react'

export function HomePage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { transactions, loading } = useTransactions(year, month)
  const { categories } = useCategories()
  const { tasks, reload: reloadTasks } = useTasks()
  const { budgets } = useBudgets()

  // "Disponibile oggi": (budget totale del mese − speso nelle categorie con budget) ÷ giorni rimasti
  const safeToSpend = useMemo(() => {
    if (budgets.length === 0) return null
    const budgeted = new Set(budgets.map((b) => b.category_id))
    const totalBudget = budgets.reduce((sum, b) => sum + b.monthly_cents, 0)
    const spent = transactions
      .filter((t) => t.kind === 'expense' && t.category_id !== null && budgeted.has(t.category_id))
      .reduce((sum, t) => sum + t.amount_cents, 0)
    const daysInMonth = new Date(year, month, 0).getDate()
    const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1)
    return { perDay: Math.round((totalBudget - spent) / daysLeft), remaining: totalBudget - spent, daysLeft }
  }, [budgets, transactions, year, month, now])

  const today = todayISO()
  const todayTasks = useMemo(
    () => tasks.filter((t) => !t.done && t.due_date !== null && t.due_date <= today).slice(0, 4),
    [tasks, today],
  )

  async function completeTask(id: string) {
    await supabase.from('tasks').update({ done: true }).eq('id', id)
    void reloadTasks()
  }
  const [history, setHistory] = useState<Array<{ month: string; income: number; expense: number }>>([])

  useEffect(() => {
    void fetchMonthlyTotals(6).then(setHistory)
  }, [])

  const totals = useMemo(() => sumByKind(transactions), [transactions])

  const pieData = useMemo(() => {
    const byCategory = new Map<string, number>()
    for (const t of transactions) {
      if (t.kind !== 'expense') continue
      const key = t.category_id ?? 'none'
      byCategory.set(key, (byCategory.get(key) ?? 0) + t.amount_cents)
    }
    const catById = new Map(categories.map((c) => [c.id, c]))
    return Array.from(byCategory.entries())
      .map(([id, value]) => ({
        name: catById.get(id)?.name ?? 'Altro',
        value,
        color: catById.get(id)?.color ?? '#71717a',
      }))
      .sort((a, b) => b.value - a.value)
  }, [transactions, categories])

  const barData = history.map((h) => {
    const [y, m] = h.month.split('-').map(Number)
    return {
      name: MONTH_NAMES[m - 1].slice(0, 3),
      label: monthLabel(y, m),
      Entrate: h.income / 100,
      Uscite: h.expense / 100,
      incomeCents: h.income,
      expenseCents: h.expense,
    }
  })

  // Mese selezionato nel grafico "Ultimi 6 mesi" (default: mese corrente, l'ultimo)
  const [selectedBar, setSelectedBar] = useState<number | null>(null)
  const activeIndex = selectedBar ?? barData.length - 1
  const activeMonth = barData[activeIndex]

  return (
    <div className="pb-28">
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-5 py-3">
          <img
            src={`${import.meta.env.BASE_URL}pwa-192.png`}
            alt=""
            className="h-10 w-10 rounded-xl shadow-sm"
          />
          <div>
            <h1 className="bg-gradient-to-r from-accent to-income bg-clip-text text-[26px] font-black tracking-[0.18em] leading-none text-transparent">
              AJE
            </h1>
            <p className="mt-0.5 text-xs capitalize text-muted">
              {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-5 pt-4">
        <Card className="bg-accent text-white border-transparent">
          <div className="flex items-center gap-2 text-white/80">
            <Wallet className="h-4 w-4" />
            <span className="text-sm">Saldo del mese</span>
          </div>
          <p className="mt-1 text-4xl font-bold tracking-tight">
            {loading ? '…' : formatCents(totals.balance)}
          </p>
          <div className="mt-3 flex gap-5 text-sm">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" /> {formatCents(totals.income)}
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4" /> {formatCents(totals.expense)}
            </span>
          </div>
        </Card>

        {safeToSpend && (
          <Card className="flex items-center gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${
                safeToSpend.perDay >= 0 ? 'bg-income' : 'bg-expense'
              }`}
            >
              <Euro className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted">Disponibile oggi (dai tuoi budget)</span>
              <span
                className={`block text-xl font-bold ${safeToSpend.perDay >= 0 ? 'text-income' : 'text-expense'}`}
              >
                {formatCents(safeToSpend.perDay)}
              </span>
            </span>
            <span className="text-right text-xs text-muted">
              {formatCents(safeToSpend.remaining)}
              <br />
              in {safeToSpend.daysLeft} giorni
            </span>
          </Card>
        )}

        <Link
          to="/assistente"
          className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Bot className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Chiedi ad AJE</span>
            <span className="block truncate text-sm text-muted">
              "Quanto ho speso in ristoranti quest'anno?"
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-accent" />
        </Link>

        {todayTasks.length > 0 && (
          <Card>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-semibold">Da fare oggi</h2>
              <Link to="/agenda" className="text-sm font-medium text-accent">
                Agenda
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {todayTasks.map((t) => {
                const overdue = t.due_date !== null && t.due_date < today
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <button
                      onClick={() => completeTask(t.id)}
                      aria-label={`Completa ${t.title}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-line text-transparent transition active:border-income active:bg-income active:text-white"
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </button>
                    <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                    <span className={`text-xs ${overdue ? 'font-semibold text-expense' : 'text-muted'}`}>
                      {overdue ? 'in ritardo' : t.due_time ? t.due_time.slice(0, 5) : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        <Card>
          <h2 className="mb-1 font-semibold">Uscite per categoria</h2>
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : pieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Nessuna uscita questo mese. Aggiungi i movimenti da Finanze.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={70}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-0 flex-1 text-sm">
                {pieData.slice(0, 5).map((d) => (
                  <li key={d.name} className="flex items-center gap-2 py-1">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="truncate flex-1">{d.name}</span>
                    <span className="font-semibold">{formatCents(d.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">Ultimi 6 mesi</h2>
            <span className="text-xs text-muted">Tocca un mese</span>
          </div>
          <div className="relative h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barGap={2}>
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                />
                <Bar dataKey="Entrate" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {barData.map((d, i) => (
                    <Cell
                      key={d.label}
                      fill="var(--income)"
                      opacity={i === activeIndex ? 1 : 0.35}
                    />
                  ))}
                </Bar>
                <Bar dataKey="Uscite" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {barData.map((d, i) => (
                    <Cell
                      key={d.label}
                      fill="var(--expense)"
                      opacity={i === activeIndex ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Zone touch invisibili: una colonna per mese */}
            <div className="absolute inset-0 grid grid-cols-6">
              {barData.map((d, i) => (
                <button
                  key={d.label}
                  aria-label={`Dettagli ${d.label}`}
                  onClick={() => setSelectedBar(i)}
                  className="h-full w-full"
                />
              ))}
            </div>
          </div>
          {activeMonth && (
            <div className="mt-3 rounded-xl bg-card-2 px-4 py-3">
              <p className="mb-2 text-sm font-semibold">{activeMonth.label}</p>
              <div className="grid grid-cols-3 text-center">
                <div>
                  <p className="text-xs text-muted">Entrate</p>
                  <p className="font-bold text-income">{formatCents(activeMonth.incomeCents)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Uscite</p>
                  <p className="font-bold text-expense">{formatCents(activeMonth.expenseCents)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Saldo</p>
                  <p
                    className={`font-bold ${
                      activeMonth.incomeCents - activeMonth.expenseCents >= 0
                        ? 'text-income'
                        : 'text-expense'
                    }`}
                  >
                    {formatCents(activeMonth.incomeCents - activeMonth.expenseCents)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Link
          to="/documenti"
          className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 shadow-sm"
        >
          <div>
            <p className="font-semibold">Carica la busta paga</p>
            <p className="text-sm text-muted">Analisi automatica e stipendio nelle entrate</p>
          </div>
          <ArrowRight className="h-5 w-5 text-accent" />
        </Link>
      </div>
    </div>
  )
}
