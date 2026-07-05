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
import { Card, PageHeader, Spinner } from '../../components/ui'
import { fetchMonthlyTotals, sumByKind, useCategories, useTransactions } from '../../lib/data'
import { MONTH_NAMES, formatCents, monthLabel } from '../../lib/format'

export function HomePage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { transactions, loading } = useTransactions(year, month)
  const { categories } = useCategories()
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
      <PageHeader title="Ciao 👋" subtitle={monthLabel(year, month)} />

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
