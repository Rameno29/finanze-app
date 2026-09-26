import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Delete, Trash2 } from 'lucide-react'
import { currentUserId, mutateOffline } from '../../lib/offline'
import { todayISO } from '../../lib/format'
import { defaultAccountId, padAppend, padBackspace, rememberLastAccount, sheetDateLabel } from '../../lib/finance'
import { notifyDataChanged } from '../../lib/data'
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
import { Sheet, Spinner } from '../../components/ui'
import { Chip } from '../../components/Chip'
import { Segmented } from '../../components/Segmented'
import { useToast } from '../../components/toastContext'
import { AccountIcon } from './AccountIcon'
import type { Account, Category, Kind, Transaction } from '../../types'

export interface TransactionDraft {
  kind?: Kind
  amount_cents?: number | null
  category_id?: string | null
  date?: string | null
  description?: string
  currency_code?: CurrencyCode
}

const RECURRENCE_LABELS: Record<string, string> = {
  '': 'Nessuna ricorrenza',
  mensile: 'Ogni mese',
  settimanale: 'Ogni settimana',
  annuale: 'Ogni anno',
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'] as const

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export function TransactionSheet({
  open,
  onClose,
  onSaved,
  categories,
  accounts,
  editing,
  draft,
}: {
  open: boolean
  onClose: () => void
  /** Facoltativo: le viste montate si aggiornano comunque tramite `notifyDataChanged()`. */
  onSaved?: () => void
  categories: Category[]
  accounts: Account[]
  editing: Transaction | null
  draft?: TransactionDraft | null
}) {
  const toast = useToast()
  const [kind, setKind] = useState<Kind>('expense')
  const [cents, setCents] = useState(0)
  const [categoryId, setCategoryId] = useState<string>('')
  const [accountId, setAccountId] = useState<string>('')
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [recurrence, setRecurrence] = useState<string>('')
  const [currency, setCurrency] = useState<CurrencyCode>('EUR')
  const [rate, setRate] = useState<ExchangeRate | null>(null)
  const [rateBusy, setRateBusy] = useState(false)
  const [rateError, setRateError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shakes, setShakes] = useState(0)
  /** Conteggio dei tentativi di salvataggio senza conto: > 0 evidenzia la scelta in rosso. */
  const [accountShakes, setAccountShakes] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  /** true quando il conto è stato scelto dall'utente o viene da un movimento esistente. */
  const accountChosenRef = useRef(false)
  const formId = useId()

  useEffect(() => {
    if (!open) return
    if (editing) {
      const editingCurrency = isCurrencyCode(editing.currency_code) ? editing.currency_code : 'EUR'
      setKind(editing.kind)
      setCurrency(editingCurrency)
      setCents(editing.original_amount_cents ?? editing.amount_cents)
      setCategoryId(editing.category_id ?? '')
      setAccountId(editing.account_id ?? '')
      accountChosenRef.current = true
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
      setCents(draft.amount_cents ?? 0)
      setCategoryId(draft.category_id ?? '')
      setAccountId('')
      accountChosenRef.current = false
      setDate(draft.date ?? todayISO())
      setDescription(draft.description ?? '')
      setRecurrence('')
      setCurrency(draft.currency_code ?? 'EUR')
      setRate(null)
    } else {
      setKind('expense')
      setCents(0)
      setCategoryId('')
      setAccountId('')
      accountChosenRef.current = false
      setDate(todayISO())
      setDescription('')
      setRecurrence('')
      setCurrency('EUR')
      setRate(null)
    }
    setError('')
    setShakes(0)
    setAccountShakes(0)
  }, [open, editing, draft])

  // Nuovo movimento: propone l'ultimo conto usato (anche se i conti arrivano dopo l'apertura del foglio)
  useEffect(() => {
    if (!open || accountChosenRef.current || accountId || accounts.length === 0) return
    setAccountId(defaultAccountId(accounts))
  }, [open, accountId, accounts])

  useEffect(() => {
    if (!open) return
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
  }, [open, cents, currency, date])

  // Tastiera fisica: cifre e Backspace (fuori dai campi di testo), Invio salva. Esc lo gestisce il foglio.
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault()
        setCents((value) => padAppend(value, event.key))
      } else if (event.key === 'Backspace') {
        event.preventDefault()
        setCents((value) => padBackspace(value))
      } else if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault()
        formRef.current?.requestSubmit()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const visibleCategories = categories.filter((c) => c.kind === kind)
  const amountLabel = formatCurrencyCents(cents, currency)
  const kindWord = kind === 'expense' ? 'uscita' : 'entrata'
  const accountMissing = accounts.length > 0 && !accounts.some((a) => a.id === accountId)
  const accountAlert = accountShakes > 0 && accountMissing

  function chooseAccount(id: string) {
    accountChosenRef.current = true
    setAccountId(id)
  }

  function pressKey(key: (typeof KEYS)[number]) {
    setCents((value) => (key === 'back' ? padBackspace(value) : padAppend(value, key)))
  }

  async function undoInsert(id: string) {
    try {
      await mutateOffline('transactions', 'delete', id, {}, null)
      notifyDataChanged()
    } catch {
      toast({ text: 'Annullamento non riuscito, riprova dalla lista dei movimenti.' })
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!cents) {
      setShakes((count) => count + 1)
      return
    }
    if (accountMissing) {
      setAccountShakes((count) => count + 1)
      return
    }
    setBusy(true)
    setError('')
    try {
      const userId = await currentUserId()
      const appliedRate = await getExchangeRate(currency, date)
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
        account_id: accountId || null,
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
        transfer_group: editing?.transfer_group ?? null,
        created_at: (editing as Transaction & { created_at?: string } | null)?.created_at ?? new Date().toISOString(),
      }
      await mutateOffline(
        'transactions', editing ? 'update' : 'insert', recordId,
        editing ? values : insertPayload,
        localRecord,
      )
      if (!editing) rememberLastAccount(accountId || null)
      onClose()
      onSaved?.()
      notifyDataChanged()
      if (editing) toast({ text: 'Movimento aggiornato' })
      else toast({ text: `${kind === 'expense' ? 'Uscita' : 'Entrata'} di ${amountLabel} salvata`, onUndo: () => void undoInsert(recordId) })
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
      onClose()
      onSaved?.()
      notifyDataChanged()
      toast({ text: 'Movimento eliminato' })
    } catch {
      setBusy(false)
      setError('Eliminazione non riuscita, riprova.')
    }
  }

  const saveDisabled = busy || rateBusy || Boolean(rateError && currency !== 'EUR')
  const footer = (
    <div className="flex flex-col gap-2">
      <button
        type="submit"
        form={formId}
        disabled={saveDisabled}
        className={`tabular flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50 ${
          accountAlert ? 'bg-expense' : 'bg-accent'
        }`}
      >
        {busy
          ? <Spinner className="h-5 w-5 text-white" />
          : !cents ? 'Inserisci un importo'
          : accountAlert ? 'Scegli un conto'
          : `Salva ${kindWord} · ${amountLabel}`}
      </button>
      {editing && (
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={busy}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] font-semibold text-expense"
        >
          <Trash2 className="h-5 w-5" /> Elimina movimento
        </button>
      )}
    </div>
  )

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Modifica movimento' : 'Nuovo movimento'} footer={footer}>
      <form id={formId} ref={formRef} onSubmit={handleSubmit} noValidate>
        <Segmented
          label="Tipo di movimento"
          value={kind}
          onChange={(next) => {
            if (next === kind) return
            setKind(next)
            setCategoryId('')
          }}
          options={[
            { value: 'expense', label: 'Uscita', color: 'var(--expense)' },
            { value: 'income', label: 'Entrata', color: 'var(--income)' },
          ]}
        />

        <output
          key={shakes}
          aria-label="Importo"
          aria-live="polite"
          className={`tabular mt-[18px] block text-center text-[52px] font-semibold leading-tight tracking-[-0.035em] ${
            shakes ? 'amount-shake' : ''
          } ${!cents ? 'text-muted' : kind === 'income' ? 'text-income' : 'text-ink'}`}
        >
          {amountLabel}
        </output>

        <div role="group" aria-label="Categoria" className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
          {visibleCategories.map((c) => (
            <Chip
              key={c.id}
              variant="choice"
              selected={categoryId === c.id}
              onClick={() => setCategoryId(categoryId === c.id ? '' : c.id)}
              icon={<span style={{ color: c.color }}><CategoryIcon icon={c.icon} className="h-[18px] w-[18px]" /></span>}
            >
              {c.name}
            </Chip>
          ))}
        </div>

        {accounts.length > 0 && (
          <div
            key={accountShakes}
            className={`-mx-2.5 mt-3 rounded-2xl border-[1.5px] px-2.5 pb-2.5 pt-2 transition-colors ${
              accountAlert ? 'amount-shake border-expense bg-expense/5' : 'border-transparent'
            }`}
          >
            <p aria-hidden="true" className={`mb-1.5 text-[13px] font-medium ${accountAlert ? 'text-expense' : 'text-muted'}`}>
              {accountAlert ? 'Seleziona un conto per salvare' : accountMissing ? 'Seleziona conto' : 'Conto'}
            </p>
            <div role="group" aria-label="Conto" aria-invalid={accountAlert || undefined} className="no-scrollbar flex gap-2 overflow-x-auto">
              {accounts.map((a) => (
                <Chip
                  key={a.id}
                  variant="choice"
                  selected={accountId === a.id}
                  onClick={() => chooseAccount(a.id)}
                  icon={<AccountIcon kind={a.kind} className="h-[18px] w-[18px] shrink-0" />}
                  className={accountAlert ? 'border-expense' : ''}
                >
                  {a.name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3">
          <input
            aria-label="Descrizione (facoltativa)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            className="h-11 w-full min-w-0 rounded-xl border border-line bg-card-2 px-3.5 outline-none focus:border-accent"
            placeholder="Descrizione (facoltativa)"
          />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-1 text-[13px] text-muted">
          <label className="relative inline-flex min-h-11 cursor-pointer items-center">
            <span>{sheetDateLabel(date, todayISO())}</span>
            <input
              type="date"
              aria-label="Data"
              required
              value={date}
              onChange={(e) => { if (e.target.value) setDate(e.target.value) }}
              onClick={(e) => { try { e.currentTarget.showPicker?.() } catch { /* il browser apre il suo selettore */ } }}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <span aria-hidden="true">·</span>
          <label className="relative inline-flex min-h-11 cursor-pointer items-center">
            <span>{currency}</span>
            <select
              aria-label="Valuta"
              value={currency}
              onChange={(e) => {
                const next = e.target.value
                if (isCurrencyCode(next)) {
                  setCurrency(next)
                  if (next !== 'EUR') setRecurrence('')
                }
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {SUPPORTED_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </label>
          <span aria-hidden="true">·</span>
          <label className={`relative inline-flex min-h-11 items-center ${currency !== 'EUR' ? 'opacity-50' : 'cursor-pointer'}`}>
            <span>{RECURRENCE_LABELS[recurrence] ?? recurrence}</span>
            <select
              aria-label="Ricorrenza"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              disabled={currency !== 'EUR'}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="">Nessuna (una tantum)</option>
              <option value="mensile">Mensile</option>
              <option value="settimanale">Settimanale</option>
              <option value="annuale">Annuale</option>
            </select>
          </label>
        </div>

        {currency !== 'EUR' && (
          <div className="mt-1 rounded-xl bg-card-2 px-4 py-3 text-sm">
            {rateBusy ? (
              <span className="flex items-center gap-2 text-muted"><Spinner className="h-4 w-4" /> Recupero cambio BCE…</span>
            ) : rate && rate.currency === currency && cents ? (
              <>
                <p className="font-semibold">
                  Controvalore: {formatCurrencyCents(convertToEurCents(cents, rate.rate_to_eur), 'EUR')}
                </p>
                <p className="mt-1 text-xs text-muted">
                  BCE {rate.observed_on} · 1 {currency} = {rate.rate_to_eur.toFixed(6)} EUR
                </p>
              </>
            ) : <p className="text-xs text-expense">{rateError || 'Inserisci importo e data per calcolare il cambio.'}</p>}
            <p className="mt-1 text-xs text-muted">Le ricorrenze multivaluta non sono ancora automatiche.</p>
          </div>
        )}

        {error && <p role="alert" className="mt-3 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}

        <div className="mt-2 grid grid-cols-3 grid-rows-[repeat(4,minmax(44px,56px))] gap-1">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => pressKey(key)}
              aria-label={key === 'back' ? 'Cancella' : undefined}
              className="pad-key flex items-center justify-center rounded-2xl text-[26px] font-medium"
            >
              {key === 'back' ? <Delete className="h-6 w-6" strokeWidth={1.9} /> : key}
            </button>
          ))}
        </div>
      </form>
    </Sheet>
  )
}
