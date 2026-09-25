import { useState } from 'react'
import { Minus, PiggyBank, Plus, Trash2 } from 'lucide-react'
import { requireUserId, supabase } from '../../lib/supabase'
import { formatCents, parseAmountToCents } from '../../lib/format'
import { EmptyState, Field, PrimaryButton, Sheet, Spinner, inputClass } from '../../components/ui'
import { ProgressBar } from '../../components/ProgressBar'
import type { Goal } from '../../types'

function deadlineLabel(deadline: string | null) {
  if (!deadline) return 'senza scadenza'
  return new Date(`${deadline}T12:00:00`).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }).replace('.', '')
}

export function GoalsView({
  goals,
  loading,
  onChanged,
  visible = true,
}: {
  goals: Goal[]
  loading: boolean
  onChanged: () => void
  /** Le barre partono da 0 quando la vista diventa visibile. */
  visible?: boolean
}) {
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
    setError('')
    try {
      const userId = await requireUserId()
      const { error: insertError } = await supabase.from('goals').insert({
        user_id: userId,
        name: name.trim(),
        target_cents: cents,
        deadline: deadline || null,
      })
      if (insertError) throw insertError
      setCreateOpen(false)
      setName('')
      setTarget('')
      setDeadline('')
      onChanged()
    } catch {
      setError('Creazione non riuscita, riprova.')
    } finally {
      setBusy(false)
    }
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
    const { data: updated, error: updateError } = await supabase
      .from('goals')
      .update({ saved_cents: newSaved })
      .eq('id', active.id)
      .eq('saved_cents', active.saved_cents)
      .select('id')
      .maybeSingle()
    setBusy(false)
    if (updateError || !updated) {
      setError('L’obiettivo è cambiato nel frattempo: aggiorno i dati, poi riprova.')
      onChanged()
      return
    }
    setActive(null)
    setAmount('')
    onChanged()
  }

  async function deleteGoal() {
    if (!active) return
    if (!window.confirm(`Eliminare l'obiettivo "${active.name}"?`)) return
    const { error: deleteError } = await supabase.from('goals').delete().eq('id', active.id)
    if (deleteError) setError('Eliminazione non riuscita, riprova.')
    else {
      setActive(null)
      onChanged()
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  function openGoal(g: Goal) {
    setActive(g)
    setAmount('')
    setError('')
  }

  return (
    <div>
      {goals.length === 0 ? (
        <EmptyState
          icon={<PiggyBank />}
          tone="brand"
          title="Nessun obiettivo di risparmio"
          hint="Crea un obiettivo (es. Vacanze, Fondo emergenze) e aggiungi i risparmi man mano."
        />
      ) : (
        goals.map((g, index) => {
          const pct = g.target_cents > 0 ? Math.min(100, Math.round((g.saved_cents / g.target_cents) * 100)) : 0
          const done = g.saved_cents >= g.target_cents
          return (
            <div key={g.id} className="border-b border-line py-5">
              <button type="button" className="block w-full text-left" onClick={() => openGoal(g)}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[17px] font-semibold">{g.name}</span>
                  <span className="shrink-0 text-sm text-muted">{deadlineLabel(g.deadline)}</span>
                </span>
                <span className="mt-1 flex items-baseline gap-2.5">
                  <span className={`tabular text-[32px] font-semibold tracking-[-0.03em] ${done ? 'text-income' : ''}`}>{pct}%</span>
                  <span className="tabular text-sm text-muted">
                    {formatCents(g.saved_cents)} di {formatCents(g.target_cents)}
                  </span>
                </span>
                <span className="mt-2 block">
                  <ProgressBar
                    percent={pct}
                    tone={done ? 'income' : 'brand'}
                    visible={visible}
                    delay={index * 120}
                    duration={1000}
                    label={`Avanzamento ${g.name}`}
                  />
                </span>
                {done && <span className="mt-2 block text-sm font-semibold text-income">Obiettivo raggiunto!</span>}
              </button>
              <button
                type="button"
                onClick={() => openGoal(g)}
                className="mt-3.5 inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium"
              >
                <Plus className="h-4 w-4" strokeWidth={1.9} /> Aggiungi risparmio
              </button>
            </div>
          )
        })
      )}

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-line text-[15px] font-medium"
      >
        <Plus className="h-5 w-5" strokeWidth={1.9} /> Nuovo obiettivo
      </button>

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
        {error && <p className="mt-3 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}
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
