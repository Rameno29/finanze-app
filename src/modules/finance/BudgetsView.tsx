import { useMemo, useState } from 'react'
import { ChevronRight, PiggyBank, RefreshCw, Tags } from 'lucide-react'
import { requireUserId, supabase } from '../../lib/supabase'
import { useRecurring } from '../../lib/data'
import { formatCents, parseAmountToCents } from '../../lib/format'
import { budgetTone } from '../../lib/finance'
import { ProgressBar } from '../../components/ProgressBar'
import { CategoryIcon } from '../../lib/icons'
import { EmptyState, Field, PrimaryButton, Sheet, inputClass } from '../../components/ui'
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
  visible = true,
  onManageCategories,
}: {
  categories: Category[]
  budgets: Budget[]
  transactions: Transaction[]
  onChanged: () => void
  /** Le barre partono da 0 quando la vista diventa visibile. */
  visible?: boolean
  onManageCategories?: () => void
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

  function openEditor(c: Category) {
    const budget = budgetByCategory.get(c.id)
    setEditingCategory(c)
    setAmount(budget ? (budget.monthly_cents / 100).toFixed(2).replace('.', ',') : '')
    setError('')
  }

  const manageCategories = onManageCategories && (
    <button
      type="button"
      onClick={onManageCategories}
      className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-line text-[15px] font-medium"
    >
      <Tags className="h-5 w-5" strokeWidth={1.9} /> Gestisci categorie
    </button>
  )

  if (expenseCategories.length === 0) {
    return (
      <div>
        <EmptyState
          icon={<PiggyBank />}
          tone="brand"
          title="Nessuna categoria di spesa"
          hint="Crea prima le categorie di spesa, poi imposta un limite mensile."
        />
        {manageCategories}
      </div>
    )
  }

  const withBudget = expenseCategories.filter((c) => budgetByCategory.has(c.id))
  const withoutBudget = expenseCategories.filter((c) => !budgetByCategory.has(c.id))
  const totalLimit = withBudget.reduce((sum, c) => sum + (budgetByCategory.get(c.id)?.monthly_cents ?? 0), 0)
  const totalSpent = withBudget.reduce((sum, c) => sum + (spentByCategory.get(c.id) ?? 0), 0)

  return (
    <div>
      {withBudget.length > 0 ? (
        <>
          <p className="text-sm text-muted">Budget del mese</p>
          <p className="tabular mt-0.5 text-[30px] font-semibold leading-tight tracking-[-0.02em]">
            {formatCents(totalSpent)} di {formatCents(totalLimit)}
          </p>
          <div className="mt-1">
            {withBudget.map((c, index) => {
              const limit = budgetByCategory.get(c.id)!.monthly_cents
              const spent = spentByCategory.get(c.id) ?? 0
              const left = limit - spent
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openEditor(c)}
                  className="block w-full border-b border-line py-[18px] text-left"
                >
                  <span className="mb-2.5 flex items-center gap-2.5">
                    <span style={{ color: c.color }} aria-hidden="true"><CategoryIcon icon={c.icon} className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{c.name}</span>
                    <span className="tabular shrink-0 text-sm">{formatCents(spent)} / {formatCents(limit)}</span>
                  </span>
                  <ProgressBar
                    percent={limit > 0 ? (spent / limit) * 100 : 100}
                    tone={budgetTone(spent, limit)}
                    visible={visible}
                    delay={index * 90}
                    label={`Budget ${c.name}`}
                  />
                  <span className={`tabular mt-2 block text-[13px] ${left < 0 ? 'text-expense' : 'text-muted'}`}>
                    {left < 0 ? `Superato di ${formatCents(-left)}` : `Restano ${formatCents(left)}`}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Tocca una categoria per impostare un limite mensile: vedrai quanto hai già speso.</p>
      )}

      {withoutBudget.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-1 text-[13px] font-semibold text-muted">Senza budget</h3>
          {withoutBudget.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => openEditor(c)}
              className="flex min-h-[52px] w-full items-center gap-2.5 border-b border-line text-left"
            >
              <span style={{ color: c.color }} aria-hidden="true"><CategoryIcon icon={c.icon} className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1 truncate text-[15px]">{c.name}</span>
              <span className="text-[13px] text-muted">Imposta</span>
              <ChevronRight className="h-4 w-4 text-muted" strokeWidth={1.9} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {/* Scadenzario: spese fisse e abbonamenti (movimenti con ricorrenza) */}
      {recurringExpenses.length > 0 && (
        <section className="mt-7">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold">
              <RefreshCw className="h-4 w-4 text-brand" strokeWidth={1.9} /> Spese fisse e abbonamenti
            </h3>
            <span className="tabular text-sm font-semibold">{formatCents(recurringMonthlyTotal)}/mese</span>
          </div>
          <p className="tabular mb-1 text-[13px] text-muted">
            Pari a {formatCents(recurringMonthlyTotal * 12)} all'anno · si rinnovano da soli
          </p>
          <ul>
            {recurringExpenses.map((t) => (
              <li key={t.id} className="flex min-h-[52px] items-center gap-2 border-b border-line text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{t.description || 'Spesa ricorrente'}</span>
                <span className="text-[13px] text-muted">{t.recurrence}</span>
                <span className="tabular font-semibold">{formatCents(t.amount_cents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {manageCategories}

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
