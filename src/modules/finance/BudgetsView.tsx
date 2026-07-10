import { useMemo, useState } from 'react'
import { PiggyBank, RefreshCw } from 'lucide-react'
import { requireUserId, supabase } from '../../lib/supabase'
import { useRecurring } from '../../lib/data'
import { formatCents, parseAmountToCents } from '../../lib/format'
import { CategoryIcon } from '../../lib/icons'
import { Card, EmptyState, Field, PrimaryButton, Sheet, inputClass } from '../../components/ui'
import type { Budget, Category, Transaction } from '../../types'

/** Equivalente mensile in centesimi di un movimento ricorrente. */
function monthlyEquivalent(t: Transaction): number {
  if (t.recurrence === 'settimanale') return Math.round((t.amount_cents * 52) / 12)
  if (t.recurrence === 'annuale') return Math.round(t.amount_cents / 12)
  return t.amount_cents
}

export function BudgetsView({
  categories,
  budgets,
  transactions,
  onChanged,
}: {
  categories: Category[]
  budgets: Budget[]
  transactions: Transaction[]
  onChanged: () => void
}) {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { recurring } = useRecurring()

  const recurringExpenses = useMemo(() => recurring.filter((t) => t.kind === 'expense'), [recurring])
  const recurringMonthlyTotal = useMemo(
    () => recurringExpenses.reduce((sum, t) => sum + monthlyEquivalent(t), 0),
    [recurringExpenses],
  )

  const expenseCategories = categories.filter((c) => c.kind === 'expense')
  const budgetByCategory = useMemo(
    () => new Map(budgets.map((b) => [b.category_id, b])),
    [budgets],
  )
  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (t.kind !== 'expense' || !t.category_id) continue
      map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount_cents)
    }
    return map
  }, [transactions])

  async function saveBudget() {
    if (!editingCategory) return
    setError('')
    const cents = parseAmountToCents(amount)
    if (amount.trim() && !cents) {
      setError('Inserisci un importo valido oppure lascia vuoto per rimuovere il budget.')
      return
    }
    setBusy(true)
    try {
      const existing = budgetByCategory.get(editingCategory.id)
      let result
      if (!cents) {
        result = existing ? await supabase.from('budgets').delete().eq('id', existing.id) : null
      } else if (existing) {
        result = await supabase.from('budgets').update({ monthly_cents: cents }).eq('id', existing.id)
      } else {
        const userId = await requireUserId()
        result = await supabase.from('budgets').insert({
          user_id: userId,
          category_id: editingCategory.id,
          monthly_cents: cents,
        })
      }
      if (result?.error) throw result.error
      setEditingCategory(null)
      onChanged()
    } catch {
      setError('Salvataggio del budget non riuscito, riprova.')
    } finally {
      setBusy(false)
    }
  }

  if (expenseCategories.length === 0) {
    return (
      <EmptyState
        icon={<PiggyBank className="h-10 w-10" />}
        title="Nessuna categoria di spesa"
        hint="Crea prima le categorie nella scheda Categorie."
      />
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <p className="text-sm text-muted">
        Imposta un limite mensile per categoria: la barra mostra quanto hai già speso questo mese.
      </p>
      {expenseCategories.map((c) => {
        const budget = budgetByCategory.get(c.id)
        const spent = spentByCategory.get(c.id) ?? 0
        const pct = budget ? Math.min(100, Math.round((spent / budget.monthly_cents) * 100)) : 0
        const over = budget ? spent > budget.monthly_cents : false
        return (
          <Card key={c.id} className="p-3">
            <button
              className="flex w-full items-center gap-3 text-left"
              onClick={() => {
                setEditingCategory(c)
                setAmount(budget ? (budget.monthly_cents / 100).toFixed(2).replace('.', ',') : '')
                setError('')
              }}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: c.color }}
              >
                <CategoryIcon icon={c.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{c.name}</span>
                  <span className={`text-sm font-semibold ${over ? 'text-expense' : 'text-muted'}`}>
                    {budget
                      ? `${formatCents(spent)} / ${formatCents(budget.monthly_cents)}`
                      : 'Nessun budget'}
                  </span>
                </span>
                {budget && (
                  <span className="mt-2 block h-2 overflow-hidden rounded-full bg-card-2">
                    <span
                      className={`block h-full rounded-full transition-all ${over ? 'bg-expense' : 'bg-accent'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                )}
              </span>
            </button>
          </Card>
        )
      })}

      {/* Scadenzario: spese fisse e abbonamenti (movimenti con ricorrenza) */}
      {recurringExpenses.length > 0 && (
        <Card className="mt-2 p-4">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <RefreshCw className="h-4 w-4 text-accent" /> Spese fisse e abbonamenti
            </h3>
            <span className="text-sm font-bold text-expense">
              {formatCents(recurringMonthlyTotal)}/mese
            </span>
          </div>
          <p className="mb-2 text-xs text-muted">
            Pari a {formatCents(recurringMonthlyTotal * 12)} all'anno · si rinnovano da soli
          </p>
          <ul className="divide-y divide-line">
            {recurringExpenses.map((t) => (
              <li key={t.id} className="flex items-baseline gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {t.description || 'Spesa ricorrente'}
                </span>
                <span className="text-xs text-muted">{t.recurrence}</span>
                <span className="font-semibold">{formatCents(t.amount_cents)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Sheet
        open={editingCategory !== null}
        onClose={() => setEditingCategory(null)}
        title={`Budget · ${editingCategory?.name ?? ''}`}
      >
        <Field label="Limite mensile (€) — lascia vuoto per rimuovere">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputClass} text-2xl font-bold`}
            placeholder="0,00"
          />
        </Field>
        {error && <p className="mb-4 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}
        <PrimaryButton onClick={saveBudget} disabled={busy}>
          Salva budget
        </PrimaryButton>
      </Sheet>
    </div>
  )
}
