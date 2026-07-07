import { useEffect, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { parseAmountToCents, todayISO } from '../../lib/format'
import { CategoryIcon } from '../../lib/icons'
import { Field, PrimaryButton, Sheet, Spinner, inputClass } from '../../components/ui'
import type { Category, Kind, Transaction } from '../../types'

export function TransactionSheet({
  open,
  onClose,
  onSaved,
  categories,
  editing,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  categories: Category[]
  editing: Transaction | null
}) {
  const [kind, setKind] = useState<Kind>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [recurrence, setRecurrence] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setKind(editing.kind)
      setAmount((editing.amount_cents / 100).toFixed(2).replace('.', ','))
      setCategoryId(editing.category_id ?? '')
      setDate(editing.date)
      setDescription(editing.description)
      setRecurrence(editing.recurrence ?? '')
    } else {
      setKind('expense')
      setAmount('')
      setCategoryId('')
      setDate(todayISO())
      setDescription('')
      setRecurrence('')
    }
    setError('')
  }, [open, editing])

  const visibleCategories = categories.filter((c) => c.kind === kind)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const cents = parseAmountToCents(amount)
    if (!cents) {
      setError('Inserisci un importo valido (es. 12,50)')
      return
    }
    setBusy(true)
    const { data: userData } = await supabase.auth.getUser()
    const payload = {
      user_id: userData.user!.id,
      amount_cents: cents,
      kind,
      category_id: categoryId || null,
      date,
      description: description.trim(),
      recurrence: recurrence || null,
    }
    const result = editing
      ? await supabase.from('transactions').update(payload).eq('id', editing.id)
      : await supabase.from('transactions').insert(payload)
    setBusy(false)
    if (result.error) {
      setError('Errore durante il salvataggio, riprova.')
      return
    }
    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm('Eliminare questo movimento?')) return
    setBusy(true)
    await supabase.from('transactions').delete().eq('id', editing.id)
    setBusy(false)
    onSaved()
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Modifica movimento' : 'Nuovo movimento'}>
      <form onSubmit={handleSubmit}>
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-card-2 p-1">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k)
                setCategoryId('')
              }}
              className={`min-h-[44px] rounded-lg font-semibold transition ${
                kind === k
                  ? k === 'expense'
                    ? 'bg-expense text-white'
                    : 'bg-income text-white'
                  : 'text-muted'
              }`}
            >
              {k === 'expense' ? 'Uscita' : 'Entrata'}
            </button>
          ))}
        </div>

        <Field label="Importo (€)">
          <input
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputClass} text-2xl font-bold`}
            placeholder="0,00"
          />
        </Field>

        <Field label="Categoria">
          <div className="grid grid-cols-4 gap-2">
            {visibleCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border p-1 text-[11px] font-medium transition ${
                  categoryId === c.id
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-card-2 text-muted'
                }`}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: c.color }}
                >
                  <CategoryIcon icon={c.icon} className="h-4 w-4" />
                </span>
                <span className="truncate max-w-full">{c.name}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Data">
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Descrizione (facoltativa)">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="Es. spesa al supermercato"
          />
        </Field>

        <Field label="Ricorrenza">
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
            className={inputClass}
          >
            <option value="">Nessuna (una tantum)</option>
            <option value="mensile">Mensile</option>
            <option value="settimanale">Settimanale</option>
            <option value="annuale">Annuale</option>
          </select>
        </Field>

        {error && <p className="mb-4 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}

        <PrimaryButton type="submit" disabled={busy}>
          {busy ? <Spinner className="h-5 w-5 text-white" /> : 'Salva'}
        </PrimaryButton>

        {editing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl font-semibold text-expense"
          >
            <Trash2 className="h-5 w-5" /> Elimina movimento
          </button>
        )}
      </form>
    </Sheet>
  )
}
