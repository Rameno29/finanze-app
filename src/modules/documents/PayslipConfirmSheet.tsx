import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { MONTH_NAMES, parseAmountToCents } from '../../lib/format'
import { Field, PrimaryButton, Sheet, Spinner, inputClass } from '../../components/ui'
import type { DocumentRow, PayslipAnalysis } from '../../types'

function centsToInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',')
}

/** Mostra i dati estratti dall'AI: l'utente corregge/conferma prima di salvare. */
export function PayslipConfirmSheet({
  data,
  onClose,
  onSaved,
}: {
  data: { doc: DocumentRow; analysis: PayslipAnalysis } | null
  onClose: () => void
  onSaved: () => void
}) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [net, setNet] = useState('')
  const [gross, setGross] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [createTransaction, setCreateTransaction] = useState(true)

  useEffect(() => {
    if (!data) return
    const a = data.analysis
    setYear(a.period_year ?? now.getFullYear())
    setMonth(a.period_month ?? now.getMonth() + 1)
    setNet(centsToInput(a.net_cents))
    setGross(centsToInput(a.gross_cents))
    setCreateTransaction(true)
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  if (!data) return null
  const { doc, analysis } = data

  async function save() {
    const netCents = parseAmountToCents(net)
    if (!netCents) {
      setError('Inserisci almeno lo stipendio netto.')
      return
    }
    setBusy(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user!.id

      const { error: psErr } = await supabase.from('payslips').upsert(
        {
          user_id: userId,
          document_id: doc.id,
          period_year: year,
          period_month: month,
          net_cents: netCents,
          gross_cents: parseAmountToCents(gross),
          deductions: analysis.deductions ?? {},
          vacation_days: analysis.vacation_days,
          leave_hours: analysis.leave_hours,
          raw_data: analysis as unknown as Record<string, unknown>,
        },
        { onConflict: 'user_id,document_id' },
      )
      if (psErr) throw psErr

      if (createTransaction) {
        let categoryId: string | null = null
        const { data: cat } = await supabase
          .from('categories')
          .select('id')
          .eq('kind', 'income')
          .ilike('name', 'stipendio')
          .maybeSingle()
        categoryId = cat?.id ?? null

        const lastDay = new Date(year, month, 0).getDate()
        await supabase.from('transactions').insert({
          user_id: userId,
          amount_cents: netCents,
          kind: 'income',
          category_id: categoryId,
          date: `${year}-${String(month).padStart(2, '0')}-${String(Math.min(27, lastDay)).padStart(2, '0')}`,
          description: `Stipendio ${MONTH_NAMES[month - 1]} ${year}`,
          document_id: doc.id,
        })
      }

      await supabase.from('documents').update({ status: 'analizzato' }).eq('id', doc.id)
      onSaved()
    } catch {
      setError('Errore durante il salvataggio, riprova.')
    } finally {
      setBusy(false)
    }
  }

  const deductionEntries = Object.entries(analysis.deductions ?? {}).filter(
    ([, v]) => typeof v === 'number' && v > 0,
  )

  return (
    <Sheet open onClose={onClose} title="Conferma busta paga">
      <p className="mb-4 text-sm text-muted">
        Dati estratti automaticamente{analysis.employer ? ` (datore: ${analysis.employer})` : ''}.
        Controlla e correggi se serve.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="Mese">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inputClass}>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Anno">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Netto (€)">
        <input
          inputMode="decimal"
          value={net}
          onChange={(e) => setNet(e.target.value)}
          className={`${inputClass} text-2xl font-bold`}
          placeholder="0,00"
        />
      </Field>
      <Field label="Lordo (€)">
        <input
          inputMode="decimal"
          value={gross}
          onChange={(e) => setGross(e.target.value)}
          className={inputClass}
          placeholder="0,00"
        />
      </Field>

      {deductionEntries.length > 0 && (
        <div className="mb-4 rounded-xl bg-card-2 px-4 py-3 text-sm">
          <p className="mb-1 font-semibold">Trattenute rilevate</p>
          {deductionEntries.map(([k, v]) => (
            <p key={k} className="flex justify-between text-muted">
              <span className="uppercase">{k}</span>
              <span>{(v / 100).toFixed(2).replace('.', ',')} €</span>
            </p>
          ))}
        </div>
      )}

      <label className="mb-5 flex min-h-[44px] items-center gap-3">
        <input
          type="checkbox"
          checked={createTransaction}
          onChange={(e) => setCreateTransaction(e.target.checked)}
          className="h-5 w-5 accent-[var(--accent)]"
        />
        <span className="text-sm">Crea l’entrata "Stipendio" nelle finanze</span>
      </label>

      {error && <p className="mb-4 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}

      <PrimaryButton onClick={save} disabled={busy}>
        {busy ? <Spinner className="h-5 w-5 text-white" /> : 'Conferma e salva'}
      </PrimaryButton>
    </Sheet>
  )
}
