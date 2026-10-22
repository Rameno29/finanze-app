import { useEffect, useState, type FormEvent } from 'react'
import { Field, PrimaryButton, Sheet, Spinner, inputClass } from '../../components/ui'
import { Chip } from '../../components/Chip'
import { useToast } from '../../components/toastContext'
import { currentUserId, mutateOffline } from '../../lib/offline'
import { notifyDataChanged } from '../../lib/data'
import { parseSignedAmountCents } from '../../lib/csvImport'
import { adjustmentCategoryId, reconcileAdjustment } from '../../lib/finance'
import { formatCents, todayISO } from '../../lib/format'
import type { Account, Category } from '../../types'

/**
 * "Allinea al saldo reale": l'utente scrive il saldo che vede in banca e AJE registra la differenza
 * come un normale movimento sul conto. Così la rettifica entra in saldi, patrimonio, totali del mese,
 * budget, "Puoi spendere" e What-if, e si può modificare o eliminare dalla lista dei movimenti.
 */
export function ReconcileSheet({
  open,
  onClose,
  account,
  appBalanceCents,
  otherAccountsCents,
  goalsSavedCents,
  categories,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  account: Account | null
  /** Saldo attuale del conto secondo AJE. */
  appBalanceCents: number
  /** Somma dei saldi degli altri conti, per il patrimonio dopo la rettifica. */
  otherAccountsCents: number
  /** Totale risparmiato negli obiettivi non ancora raggiunti. */
  goalsSavedCents: number
  categories: Category[]
  onSaved: () => void
}) {
  const toast = useToast()
  const [real, setReal] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setReal('')
    setCategoryId('')
    setCategoryTouched(false)
    setDate(todayISO())
    setDescription('Rettifica saldo')
    setError('')
  }, [open, account])

  const realCents = real.trim() === '' ? null : parseSignedAmountCents(real)
  const adjustment = realCents === null ? null : reconcileAdjustment(appBalanceCents, realCents)
  const kindCategories = adjustment ? categories.filter((c) => c.kind === adjustment.kind) : []
  // Finché l'utente non sceglie, la categoria segue il verso della differenza.
  const effectiveCategoryId = !adjustment
    ? ''
    : categoryTouched && kindCategories.some((c) => c.id === categoryId)
      ? categoryId
      : categoryTouched && categoryId === ''
        ? ''
        : adjustmentCategoryId(categories, adjustment.kind)
  const newWealth = realCents === null ? null : otherAccountsCents + realCents
  const goalsWarning = newWealth !== null && goalsSavedCents > 0 && newWealth < goalsSavedCents

  function chooseCategory(id: string) {
    setCategoryTouched(true)
    setCategoryId(id)
  }

  async function undo(id: string) {
    try {
      await mutateOffline('transactions', 'delete', id, {}, null)
      notifyDataChanged()
      onSaved()
    } catch {
      toast({ text: 'Annullamento non riuscito, elimina la rettifica dalla lista dei movimenti.' })
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy || !account) return
    if (realCents === null) {
      setError('Scrivi il saldo che vedi in banca (es. 1.234,56 oppure -50,00).')
      return
    }
    if (!adjustment) {
      onClose()
      toast({ text: `${account.name} è già allineato` })
      return
    }
    if (!date) {
      setError('Scegli la data della rettifica.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const userId = await currentUserId()
      const id = crypto.randomUUID()
      const payload = {
        id,
        user_id: userId,
        amount_cents: adjustment.amount_cents,
        original_amount_cents: adjustment.amount_cents,
        currency_code: 'EUR',
        exchange_rate_to_eur: 1,
        exchange_rate_date: null,
        exchange_rate_source: 'EUR',
        kind: adjustment.kind,
        category_id: effectiveCategoryId || null,
        account_id: account.id,
        date,
        description: description.trim() || 'Rettifica saldo',
        recurrence: null,
      }
      await mutateOffline('transactions', 'insert', id, payload, {
        ...payload,
        document_id: null,
        transfer_group: null,
        created_at: new Date().toISOString(),
      })
      onClose()
      onSaved()
      notifyDataChanged()
      toast({ text: `${account.name} allineato a ${formatCents(realCents)}`, onUndo: () => void undo(id) })
    } catch {
      setError('Rettifica non riuscita, riprova.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Allinea al saldo reale">
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-sm text-muted">
          Saldo in AJE per <span className="font-medium text-ink">{account?.name}</span>:{' '}
          <span className="tabular font-semibold text-ink">{formatCents(appBalanceCents)}</span>
        </p>

        <Field label="Saldo reale in banca oggi (EUR)">
          <input
            inputMode="text"
            autoComplete="off"
            value={real}
            onChange={(e) => setReal(e.target.value)}
            className={`${inputClass} tabular text-2xl font-bold`}
            placeholder="0,00"
          />
        </Field>

        {realCents !== null && (
          <div aria-live="polite" className="mb-4 rounded-xl bg-card-2 px-4 py-3 text-sm">
            {!adjustment ? (
              <p>Il conto è già allineato: non serve nessuna rettifica.</p>
            ) : (
              <p>
                {adjustment.kind === 'expense' ? 'Mancano ' : 'Ci sono '}
                <span className={`tabular font-semibold ${adjustment.kind === 'expense' ? 'text-expense' : 'text-income'}`}>
                  {formatCents(adjustment.amount_cents)}
                </span>
                {adjustment.kind === 'expense'
                  ? ' di addebiti non registrati: verranno salvati come uscita.'
                  : ' di entrate non registrate: verranno salvate come entrata.'}
                {' '}Conta nei totali del mese, nei budget e in "Puoi spendere".
              </p>
            )}
          </div>
        )}

        {adjustment && (
          <>
            {/* Non dentro un <label>: darebbe a ogni chip il nome "Categoria …". */}
            <div className="mb-4">
              <p className="mb-1.5 text-sm font-medium text-muted">Categoria</p>
              <div role="group" aria-label="Categoria" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {kindCategories.map((c) => (
                  <Chip
                    key={c.id}
                    variant="choice"
                    selected={effectiveCategoryId === c.id}
                    onClick={() => chooseCategory(c.id)}
                    icon={<span className="h-3 w-3 rounded-full" style={{ background: c.color }} />}
                  >
                    {c.name}
                  </Chip>
                ))}
                <Chip variant="choice" selected={effectiveCategoryId === ''} onClick={() => chooseCategory('')}>
                  Nessuna categoria
                </Chip>
              </div>
            </div>

            <Field label="Descrizione">
              <input
                maxLength={120}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Data">
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </Field>
          </>
        )}

        {goalsWarning && newWealth !== null && (
          <p className="mb-4 rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn-text">
            Dopo la rettifica il patrimonio sui conti sarà {formatCents(newWealth)}, meno dei{' '}
            {formatCents(goalsSavedCents)} segnati come risparmiati negli obiettivi. Controlla gli obiettivi:
            il risparmio si aggiorna solo a mano.
          </p>
        )}

        {error && <p className="mb-4 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}

        <PrimaryButton type="submit" disabled={busy || realCents === null}>
          {busy ? <Spinner className="h-5 w-5 text-white" /> : adjustment ? 'Registra rettifica' : 'Allinea'}
        </PrimaryButton>

        <p className="mt-3 text-[13px] text-muted">
          La rettifica compare tra i movimenti e si può modificare o eliminare. Per correggere solo il punto di
          partenza, senza toccare le spese, modifica il saldo iniziale del conto.
        </p>
      </form>
    </Sheet>
  )
}
