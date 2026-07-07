import { useState } from 'react'
import { Minus, PiggyBank, Plus, Target, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCents, parseAmountToCents } from '../../lib/format'
import { Card, EmptyState, Field, PrimaryButton, Sheet, Spinner, inputClass } from '../../components/ui'
import type { Goal } from '../../types'

export function GoalsView({ goals, loading, onChanged }: { goals: Goal[]; loading: boolean; onChanged: () => void }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [busy, setBusy] = useState(false)

  const [active, setActive] = useState<Goal | null>(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  async function createGoal() {
    const cents = parseAmountToCents(target)
    if (!name.trim() || !cents) return
    setBusy(true)
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('goals').insert({
      user_id: userData.user!.id,
      name: name.trim(),
      target_cents: cents,
      deadline: deadline || null,
    })
    setBusy(false)
    setCreateOpen(false)
    setName('')
    setTarget('')
    setDeadline('')
    onChanged()
  }

  async function contribute(sign: 1 | -1) {
    if (!active) return
    const cents = parseAmountToCents(amount)
    if (!cents) {
      setError('Inserisci un importo valido.')
      return
    }
    setBusy(true)
    const newSaved = Math.max(0, active.saved_cents + sign * cents)
    await supabase.from('goals').update({ saved_cents: newSaved }).eq('id', active.id)
    setBusy(false)
    setActive(null)
    setAmount('')
    onChanged()
  }

  async function deleteGoal() {
    if (!active) return
    if (!window.confirm(`Eliminare l'obiettivo "${active.name}"?`)) return
    await supabase.from('goals').delete().eq('id', active.id)
    setActive(null)
    onChanged()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      {goals.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="h-10 w-10" />}
          title="Nessun obiettivo di risparmio"
          hint="Crea un obiettivo (es. Vacanze, Fondo emergenze) e aggiungi i risparmi man mano."
        />
      ) : (
        goals.map((g) => {
          const pct = Math.min(100, Math.round((g.saved_cents / g.target_cents) * 100))
          const done = g.saved_cents >= g.target_cents
          return (
            <Card key={g.id} className="p-4">
              <button className="w-full text-left" onClick={() => { setActive(g); setAmount(''); setError('') }}>
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${
                      done ? 'bg-income' : 'bg-accent'
                    }`}
                  >
                    <Target className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{g.name}</span>
                      <span className={`text-sm font-bold ${done ? 'text-income' : ''}`}>{pct}%</span>
                    </span>
                    <span className="text-sm text-muted">
                      {formatCents(g.saved_cents)} di {formatCents(g.target_cents)}
                      {g.deadline &&
                        ` · entro ${new Date(g.deadline + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </span>
                  </span>
                </div>
                <span className="mt-3 block h-2.5 overflow-hidden rounded-full bg-card-2">
                  <span
                    className={`block h-full rounded-full transition-all ${done ? 'bg-income' : 'bg-accent'}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                {done && <span className="mt-2 block text-sm font-semibold text-income">🎉 Obiettivo raggiunto!</span>}
              </button>
            </Card>
          )
        })
      )}

      <PrimaryButton onClick={() => setCreateOpen(true)}>
        <Plus className="h-5 w-5" /> Nuovo obiettivo
      </PrimaryButton>

      {/* Creazione */}
      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="Nuovo obiettivo di risparmio">
        <Field label="Nome">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Es. Vacanze estate"
          />
        </Field>
        <Field label="Traguardo (€)">
          <input
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className={`${inputClass} text-2xl font-bold`}
            placeholder="0,00"
          />
        </Field>
        <Field label="Scadenza (facoltativa)">
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
        </Field>
        <PrimaryButton onClick={createGoal} disabled={busy || !name.trim() || !target.trim()}>
          Crea obiettivo
        </PrimaryButton>
      </Sheet>

      {/* Versamento / prelievo */}
      <Sheet open={active !== null} onClose={() => setActive(null)} title={active?.name ?? ''}>
        {active && (
          <>
            <p className="mb-4 text-sm text-muted">
              Risparmiati {formatCents(active.saved_cents)} di {formatCents(active.target_cents)}.
            </p>
            <Field label="Importo (€)">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputClass} text-2xl font-bold`}
                placeholder="0,00"
              />
            </Field>
            {error && <p className="mb-4 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => void contribute(-1)}
                disabled={busy}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-line font-semibold text-expense disabled:opacity-50"
              >
                <Minus className="h-5 w-5" /> Rimuovi
              </button>
              <button
                onClick={() => void contribute(1)}
                disabled={busy}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-income font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
              >
                <Plus className="h-5 w-5" /> Aggiungi
              </button>
            </div>
            <button
              onClick={deleteGoal}
              disabled={busy}
              className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl font-semibold text-expense"
            >
              <Trash2 className="h-5 w-5" /> Elimina obiettivo
            </button>
          </>
        )}
      </Sheet>
    </div>
  )
}
