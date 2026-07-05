import { useMemo, useState } from 'react'
import { PiggyBank } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCents, parseAmountToCents } from '../../lib/format'
import { CategoryIcon } from '../../lib/icons'
import { Card, EmptyState, Field, PrimaryButton, Sheet, inputClass } from '../../components/ui'
import type { Budget, Category, Transaction } from '../../types'

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
    const cents = parseAmountToCents(amount)
    setBusy(true)
    const existing = budgetByCategory.get(editingCategory.id)
    if (!cents) {
      if (existing) await supabase.from('budgets').delete().eq('id', existing.id)
    } else if (existing) {
      await supabase.from('budgets').update({ monthly_cents: cents }).eq('id', existing.id)
    } else {
      const { data: userData } = await supabase.auth.getUser()
      await supabase.from('budgets').insert({
        user_id: userData.user!.id,
        category_id: editingCategory.id,
        monthly_cents: cents,
      })
    }
    setBusy(false)
    setEditingCategory(null)
    onChanged()
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
        <PrimaryButton onClick={saveBudget} disabled={busy}>
          Salva budget
        </PrimaryButton>
      </Sheet>
    </div>
  )
}
