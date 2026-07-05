import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ListX, Plus } from 'lucide-react'
import { PageHeader, Card, EmptyState, Spinner } from '../../components/ui'
import { TransactionSheet } from './TransactionSheet'
import { BudgetsView } from './BudgetsView'
import { CategoriesView } from './CategoriesView'
import { useBudgets, useCategories, useTransactions, sumByKind } from '../../lib/data'
import { formatCents, formatDay, monthLabel } from '../../lib/format'
import { CategoryIcon } from '../../lib/icons'
import type { Transaction } from '../../types'

type View = 'movimenti' | 'budget' | 'categorie'

export function FinancePage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [view, setView] = useState<View>('movimenti')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const { categories, reload: reloadCategories } = useCategories()
  const { transactions, loading, reload } = useTransactions(year, month)
  const { budgets, reload: reloadBudgets } = useBudgets()

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )
  const totals = useMemo(() => sumByKind(transactions), [transactions])

  const byDay = useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    for (const t of transactions) {
      const list = groups.get(t.date) ?? []
      list.push(t)
      groups.set(t.date, list)
    }
    return Array.from(groups.entries())
  }, [transactions])

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  return (
    <div className="pb-28">
      <PageHeader title="Finanze" />

      <div className="mx-auto max-w-lg px-5">
        {/* Selettore vista */}
        <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-card-2 p-1">
          {(
            [
              ['movimenti', 'Movimenti'],
              ['budget', 'Budget'],
              ['categorie', 'Categorie'],
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

        {view !== 'categorie' && (
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Mese precedente"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-card-2"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="font-semibold">{monthLabel(year, month)}</span>
            <button
              onClick={() => shiftMonth(1)}
              aria-label="Mese successivo"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-card-2"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {view === 'movimenti' && (
          <>
            <Card className="mt-4">
              <div className="grid grid-cols-3 text-center">
                <div>
                  <p className="text-xs text-muted">Entrate</p>
                  <p className="font-bold text-income">{formatCents(totals.income)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Uscite</p>
                  <p className="font-bold text-expense">{formatCents(totals.expense)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Saldo</p>
                  <p className={`font-bold ${totals.balance >= 0 ? 'text-income' : 'text-expense'}`}>
                    {formatCents(totals.balance)}
                  </p>
                </div>
              </div>
            </Card>

            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : transactions.length === 0 ? (
              <EmptyState
                icon={<ListX className="h-10 w-10" />}
                title="Nessun movimento"
                hint="Tocca il bottone + per aggiungere la tua prima entrata o uscita."
              />
            ) : (
              byDay.map(([day, list]) => (
                <section key={day} className="mt-5">
                  <h3 className="mb-2 text-sm font-semibold capitalize text-muted">{formatDay(day)}</h3>
                  <Card className="divide-y divide-line p-0">
                    {list.map((t) => {
                      const cat = t.category_id ? categoryById.get(t.category_id) : undefined
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setEditing(t)
                            setSheetOpen(true)
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left"
                        >
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: cat?.color ?? '#71717a' }}
                          >
                            <CategoryIcon icon={cat?.icon ?? 'tag'} className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {t.description || cat?.name || 'Movimento'}
                            </span>
                            <span className="block text-xs text-muted">
                              {cat?.name ?? 'Senza categoria'}
                              {t.recurrence ? ` · ${t.recurrence}` : ''}
                            </span>
                          </span>
                          <span
                            className={`font-bold ${t.kind === 'income' ? 'text-income' : 'text-expense'}`}
                          >
                            {t.kind === 'income' ? '+' : '−'}{formatCents(t.amount_cents)}
                          </span>
                        </button>
                      )
                    })}
                  </Card>
                </section>
              ))
            )}
          </>
        )}

        {view === 'budget' && (
          <BudgetsView
            categories={categories}
            budgets={budgets}
            transactions={transactions}
            onChanged={reloadBudgets}
          />
        )}

        {view === 'categorie' && (
          <CategoriesView categories={categories} onChanged={reloadCategories} />
        )}
      </div>

      {/* FAB nuovo movimento */}
      {view === 'movimenti' && (
        <button
          onClick={() => {
            setEditing(null)
            setSheetOpen(true)
          }}
          aria-label="Nuovo movimento"
          className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-xl transition active:scale-95"
        >
          <Plus className="h-7 w-7" />
        </button>
      )}

      <TransactionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={reload}
        categories={categories}
        editing={editing}
      />
    </div>
  )
}
