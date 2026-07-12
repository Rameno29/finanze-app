import { useEffect, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { currentUserId, mutateOffline } from '../../lib/offline'
import { parseAmountToCents, todayISO } from '../../lib/format'
import {
  SUPPORTED_CURRENCIES,
  convertToEurCents,
  formatCurrencyCents,
  getExchangeRate,
  isCurrencyCode,
  type CurrencyCode,
  type ExchangeRate,
} from '../../lib/currency'
import { CategoryIcon } from '../../lib/icons'
import { Field, PrimaryButton, Sheet, Spinner, inputClass } from '../../components/ui'
import type { Category, Kind, Transaction } from '../../types'

export interface TransactionDraft {
  kind?: Kind
  amount_cents?: number | null
  category_id?: string | null
  date?: string | null
  description?: string
  currency_code?: CurrencyCode
}

export function TransactionSheet({
  open,
  onClose,
  onSaved,
  categories,
  editing,
  draft,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  categories: Category[]
  editing: Transaction | null
  draft?: TransactionDraft | null
}) {
  const [kind, setKind] = useState<Kind>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [recurrence, setRecurrence] = useState<string>('')
  const [currency, setCurrency] = useState<CurrencyCode>('EUR')
  const [rate, setRate] = useState<ExchangeRate | null>(null)
  const [rateBusy, setRateBusy] = useState(false)
  const [rateError, setRateError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      const editingCurrency = isCurrencyCode(editing.currency_code) ? editing.currency_code : 'EUR'
      setKind(editing.kind)
      setCurrency(editingCurrency)
      setAmount(((editing.original_amount_cents ?? editing.amount_cents) / 100).toFixed(2).replace('.', ','))
      setCategoryId(editing.category_id ?? '')
      setDate(editing.date)
      setDescription(editing.description)
      setRecurrence(editing.recurrence ?? '')
      setRate({
        currency: editingCurrency,
        requested_date: editing.date,
        observed_on: editing.exchange_rate_date ?? editing.date,
        units_per_eur: 1 / (editing.exchange_rate_to_eur ?? 1),
        rate_to_eur: editing.exchange_rate_to_eur ?? 1,
        source: 'ECB',
      })
    } else if (draft) {
      // Precompilato dall'AI (spesa a voce/frase): l'utente controlla e salva
      setKind(draft.kind ?? 'expense')
      setAmount(draft.amount_cents ? (draft.amount_cents / 100).toFixed(2).replace('.', ',') : '')
      setCategoryId(draft.category_id ?? '')
      setDate(draft.date ?? todayISO())
      setDescription(draft.description ?? '')
      setRecurrence('')
      setCurrency(draft.currency_code ?? 'EUR')
      setRate(null)
    } else {
      setKind('expense')
      setAmount('')
      setCategoryId('')
      setDate(todayISO())
      setDescription('')
      setRecurrence('')
      setCurrency('EUR')
      setRate(null)
    }
    setError('')
  }, [open, editing, draft])

  useEffect(() => {
    if (!open) return
    const cents = parseAmountToCents(amount)
    if (currency === 'EUR') {
      setRate({
        currency: 'EUR', requested_date: date, observed_on: date,
        units_per_eur: 1, rate_to_eur: 1, source: 'ECB',
      })
      setRateError('')
      return
    }
    if (!cents || !date) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setRateBusy(true)
      setRateError('')
      void getExchangeRate(currency, date)
        .then((nextRate) => { if (!cancelled) setRate(nextRate) })
        .catch(() => { if (!cancelled) setRateError('Cambio BCE non disponibile per questa data.') })
        .finally(() => { if (!cancelled) setRateBusy(false) })
    }, 400)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [open, amount, currency, date])

  const visibleCategories = categories.filter((c) => c.kind === kind)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const cents = parseAmountToCents(amount)
    if (!cents) {
      setError('Inserisci un importo valido (es. 12,50)')
      return
    }
    setBusy(true)
    try {
      const userId = await currentUserId()
      const appliedRate = currency === 'EUR' ? await getExchangeRate('EUR', date) : await getExchangeRate(currency, date)
      const eurCents = convertToEurCents(cents, appliedRate.rate_to_eur)
      const values = {
        amount_cents: eurCents,
        original_amount_cents: cents,
        currency_code: currency,
        exchange_rate_to_eur: appliedRate.rate_to_eur,
        exchange_rate_date: currency === 'EUR' ? null : appliedRate.observed_on,
        exchange_rate_source: currency === 'EUR' ? 'EUR' : 'ECB',
        kind,
        category_id: categoryId || null,
        date,
        description: description.trim(),
        recurrence: recurrence || null,
      }
      const recordId = editing?.id ?? crypto.randomUUID()
      const insertPayload = { id: recordId, ...values, user_id: userId }
      const localRecord = {
        ...(editing ?? {}),
        ...insertPayload,
        document_id: editing?.document_id ?? null,
        created_at: (editing as Transaction & { created_at?: string } | null)?.created_at ?? new Date().toISOString(),
      }
      await mutateOffline(
        'transactions', editing ? 'update' : 'insert', recordId,
        editing ? values : insertPayload,
        localRecord,
      )
      onSaved()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error && cause.message.includes('Cambio BCE')
        ? cause.message
        : 'Errore durante il salvataggio, riprova.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm('Eliminare questo movimento?')) return
    setBusy(true)
    try {
      await mutateOffline('transactions', 'delete', editing.id, {}, null)
      setBusy(false)
      onSaved()
      onClose()
    } catch {
      setBusy(false)
      setError('Eliminazione non riuscita, riprova.')
    }
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

        <div className="grid grid-cols-[1fr_112px] gap-3">
        <Field label={`Importo (${currency})`}>
          <input
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputClass} text-2xl font-bold`}
            placeholder="0,00"
          />
        </Field>
        <Field label="Valuta">
          <select
            value={currency}
            onChange={(e) => {
              const next = e.target.value
              if (isCurrencyCode(next)) {
                setCurrency(next)
                if (next !== 'EUR') setRecurrence('')
              }
            }}
            className={inputClass}
          >
            {SUPPORTED_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </Field>
        </div>

        {currency !== 'EUR' && (
          <div className="mb-4 rounded-xl bg-card-2 px-4 py-3 text-sm">
            {rateBusy ? (
              <span className="flex items-center gap-2 text-muted"><Spinner className="h-4 w-4" /> Recupero cambio BCE…</span>
            ) : rate && rate.currency === currency && parseAmountToCents(amount) ? (
              <>
                <p className="font-semibold">
                  Controvalore: {formatCurrencyCents(convertToEurCents(parseAmountToCents(amount)!, rate.rate_to_eur), 'EUR')}
                </p>
                <p className="mt-1 text-xs text-muted">
                  BCE {rate.observed_on} · 1 {currency} = {rate.rate_to_eur.toFixed(6)} EUR
                </p>
              </>
            ) : <p className="text-xs text-expense">{rateError || 'Inserisci importo e data per calcolare il cambio.'}</p>}
          </div>
        )}

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
            disabled={currency !== 'EUR'}
            className={`${inputClass} disabled:opacity-50`}
          >
            <option value="">Nessuna (una tantum)</option>
            <option value="mensile">Mensile</option>
            <option value="settimanale">Settimanale</option>
            <option value="annuale">Annuale</option>
          </select>
          {currency !== 'EUR' && <p className="mt-1 text-xs text-muted">Le ricorrenze multivaluta non sono ancora automatiche.</p>}
        </Field>

        {error && <p className="mb-4 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}

        <PrimaryButton type="submit" disabled={busy || rateBusy || Boolean(rateError && currency !== 'EUR')}>
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
