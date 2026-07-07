import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { parseAmountToCents, todayISO } from '../../lib/format'
import { useCategories } from '../../lib/data'
import { Field, PrimaryButton, Sheet, Spinner, inputClass } from '../../components/ui'
import type { DocumentRow, ReceiptAnalysis } from '../../types'

function centsToInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',')
}

/** Conferma dei dati estratti da uno scontrino: crea l'uscita nelle finanze. */
export function ReceiptConfirmSheet({
  data,
  onClose,
  onSaved,
}: {
  data: { doc: DocumentRow; analysis: ReceiptAnalysis } | null
  onClose: () => void
  onSaved: () => void
}) {
  const { categories } = useCategories()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [merchant, setMerchant] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const expenseCategories = categories.filter((c) => c.kind === 'expense')

  useEffect(() => {
    if (!data) return
    const a = data.analysis
    setAmount(centsToInput(a.total_cents))
    setDate(a.date ?? todayISO())
    setMerchant(a.merchant ?? '')
    // Prova ad abbinare la categoria suggerita dall'AI a quelle dell'utente
    const hint = (a.category_hint ?? '').toLowerCase()
    const match = expenseCategories.find((c) => c.name.toLowerCase() === hint)
    setCategoryId(match?.id ?? '')
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, categories.length])

  if (!data) return null

  async function save() {
    const cents = parseAmountToCents(amount)
    if (!cents) {
      setError('Inserisci un importo valido.')
      return
    }
    setBusy(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      await supabase.from('transactions').insert({
        user_id: userData.user!.id,
        amount_cents: cents,
        kind: 'expense',
        category_id: categoryId || null,
        date,
        description: merchant.trim() || 'Scontrino',
        document_id: data!.doc.id,
      })
      await supabase.from('documents').update({ status: 'analizzato' }).eq('id', data!.doc.id)
      onSaved()
    } catch {
      setError('Errore durante il salvataggio, riprova.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onClose={onClose} title="Conferma scontrino">
      <p className="mb-4 text-sm text-muted">
        Dati letti dallo scontrino{data.analysis.notes ? ` — ${data.analysis.notes}` : ''}. Controlla
        e correggi se serve: verrà creata un'uscita nelle finanze.
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

      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Categoria">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
            <option value="">Nessuna</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Esercente / descrizione">
        <input
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          className={inputClass}
          placeholder="Es. Esselunga"
        />
      </Field>

      {error && <p className="mb-4 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}

      <PrimaryButton onClick={save} disabled={busy}>
        {busy ? <Spinner className="h-5 w-5 text-white" /> : 'Conferma e salva uscita'}
      </PrimaryButton>
    </Sheet>
  )
}
