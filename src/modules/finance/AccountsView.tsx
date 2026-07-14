import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeftRight, CreditCard, Landmark, Plus, Trash2, Upload, Wallet } from 'lucide-react'
import { Card, EmptyState, Field, PrimaryButton, Sheet, Spinner, inputClass } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { fetchAccountBalances } from '../../lib/data'
import { currentUserId, mutateOffline } from '../../lib/offline'
import { parseSignedAmountCents } from '../../lib/csvImport'
import { formatCents, parseAmountToCents, todayISO } from '../../lib/format'
import { ImportSheet } from './ImportSheet'
import type { Account, AccountKind, Category } from '../../types'

const ACCOUNT_KINDS: Array<[AccountKind, string]> = [
  ['contanti', 'Contanti'],
  ['banca', 'Banca'],
  ['carta', 'Carta'],
]

export function AccountIcon({ kind, className }: { kind: AccountKind; className?: string }) {
  const Icon = kind === 'contanti' ? Wallet : kind === 'carta' ? CreditCard : Landmark
  return <Icon className={className} />
}

export function AccountsView({
  accounts,
  loading,
  categories,
  onChanged,
  onTransactionsChanged,
}: {
  accounts: Account[]
  loading: boolean
  categories: Category[]
  onChanged: () => void
  onTransactionsChanged: () => void
}) {
  const [balances, setBalances] = useState<Map<string, number>>(new Map())
  const [accountSheet, setAccountSheet] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [transferSheet, setTransferSheet] = useState(false)
  const [importAccount, setImportAccount] = useState<Account | null>(null)

  const reloadBalances = useCallback(async () => {
    try {
      setBalances(await fetchAccountBalances(accounts))
    } catch {
      setBalances(new Map())
    }
  }, [accounts])

  useEffect(() => {
    void reloadBalances()
  }, [reloadBalances])

  const total = accounts.reduce((sum, a) => sum + (balances.get(a.id) ?? a.initial_balance_cents), 0)

  function afterTransactionsChange() {
    onTransactionsChanged()
    void reloadBalances()
  }

  return (
    <>
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-10 w-10" />}
          title="Nessun conto"
          hint="Crea conti separati per contanti, banca e carte: ogni movimento potrà essere assegnato a un conto."
        />
      ) : (
        <>
          <Card className="mt-4 bg-accent text-white border-transparent">
            <p className="text-sm text-white/80">Patrimonio sui conti</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{formatCents(total)}</p>
          </Card>

          <Card className="mt-4 divide-y divide-line p-0">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => {
                    setEditing(account)
                    setAccountSheet(true)
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <AccountIcon kind={account.kind} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{account.name}</span>
                    <span className="block text-xs capitalize text-muted">{account.kind}</span>
                  </span>
                  <span
                    className={`shrink-0 font-bold ${
                      (balances.get(account.id) ?? 0) >= 0 ? 'text-ink' : 'text-expense'
                    }`}
                  >
                    {formatCents(balances.get(account.id) ?? account.initial_balance_cents)}
                  </span>
                </button>
                <button
                  onClick={() => setImportAccount(account)}
                  aria-label={`Importa estratto conto CSV su ${account.name}`}
                  title="Importa estratto conto CSV"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card-2 text-muted"
                >
                  <Upload className="h-4 w-4" />
                </button>
              </div>
            ))}
          </Card>
        </>
      )}

      <div className="mt-4 flex gap-3">
        <PrimaryButton
          onClick={() => {
            setEditing(null)
            setAccountSheet(true)
          }}
        >
          <Plus className="h-5 w-5" /> Nuovo conto
        </PrimaryButton>
        {accounts.length >= 2 && (
          <button
            onClick={() => setTransferSheet(true)}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-card-2 font-semibold text-ink transition active:scale-[0.98]"
          >
            <ArrowLeftRight className="h-5 w-5" /> Trasferimento
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        I trasferimenti tra conti spostano il saldo ma non contano come entrate o uscite.
      </p>

      <AccountSheet
        open={accountSheet}
        onClose={() => setAccountSheet(false)}
        editing={editing}
        onSaved={() => {
          onChanged()
          void reloadBalances()
        }}
      />

      <TransferSheet
        open={transferSheet}
        onClose={() => setTransferSheet(false)}
        accounts={accounts}
        onSaved={afterTransactionsChange}
      />

      <ImportSheet
        open={importAccount !== null}
        onClose={() => setImportAccount(null)}
        account={importAccount}
        categories={categories}
        onImported={afterTransactionsChange}
      />
    </>
  )
}

function AccountSheet({
  open,
  onClose,
  editing,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  editing: Account | null
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<AccountKind>('banca')
  const [initialBalance, setInitialBalance] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(editing?.name ?? '')
    setKind(editing?.kind ?? 'banca')
    setInitialBalance(
      editing ? (editing.initial_balance_cents / 100).toFixed(2).replace('.', ',') : '',
    )
    setError('')
  }, [open, editing])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Dai un nome al conto (es. "Conto corrente").')
      return
    }
    const cents = initialBalance.trim() === '' ? 0 : parseSignedAmountCents(initialBalance)
    if (cents === null) {
      setError('Saldo iniziale non valido (es. 250,00 oppure -50,00).')
      return
    }
    if (!navigator.onLine) {
      setError('Per gestire i conti serve la connessione a internet.')
      return
    }
    setBusy(true)
    try {
      const values = { name: trimmed, kind, initial_balance_cents: cents }
      if (editing) {
        const { error: dbError } = await supabase.from('accounts').update(values).eq('id', editing.id)
        if (dbError) throw dbError
      } else {
        const userId = await currentUserId()
        const { error: dbError } = await supabase.from('accounts').insert({ ...values, user_id: userId })
        if (dbError) throw dbError
      }
      onSaved()
      onClose()
    } catch (cause) {
      const duplicate = cause instanceof Error && /duplicate|unique/i.test(cause.message)
      setError(duplicate ? 'Hai già un conto con questo nome.' : 'Salvataggio non riuscito, riprova.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm(`Eliminare il conto "${editing.name}"? I movimenti restano, senza conto assegnato.`)) return
    if (!navigator.onLine) {
      setError('Per gestire i conti serve la connessione a internet.')
      return
    }
    setBusy(true)
    try {
      const { error: dbError } = await supabase.from('accounts').delete().eq('id', editing.id)
      if (dbError) throw dbError
      onSaved()
      onClose()
    } catch {
      setError('Eliminazione non riuscita, riprova.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Modifica conto' : 'Nuovo conto'}>
      <form onSubmit={handleSubmit}>
        <Field label="Nome">
          <input
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Es. Conto corrente"
          />
        </Field>

        <Field label="Tipo">
          <div className="grid grid-cols-3 gap-2">
            {ACCOUNT_KINDS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border text-[12px] font-medium transition ${
                  kind === value
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-card-2 text-muted'
                }`}
              >
                <AccountIcon kind={value} className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Saldo iniziale (EUR, può essere negativo)">
          <input
            inputMode="text"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            className={inputClass}
            placeholder="0,00"
          />
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
            <Trash2 className="h-5 w-5" /> Elimina conto
          </button>
        )}
      </form>
    </Sheet>
  )
}

function TransferSheet({
  open,
  onClose,
  accounts,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  accounts: Account[]
  onSaved: () => void
}) {
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setFromId(accounts[0]?.id ?? '')
    setToId(accounts[1]?.id ?? '')
    setAmount('')
    setDate(todayISO())
    setError('')
  }, [open, accounts])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const cents = parseAmountToCents(amount)
    if (!cents) {
      setError('Inserisci un importo valido (es. 100,00).')
      return
    }
    if (!fromId || !toId || fromId === toId) {
      setError('Scegli due conti diversi.')
      return
    }
    setBusy(true)
    try {
      const userId = await currentUserId()
      const fromName = accounts.find((a) => a.id === fromId)?.name ?? ''
      const toName = accounts.find((a) => a.id === toId)?.name ?? ''
      const group = crypto.randomUUID()
      const base = {
        user_id: userId,
        amount_cents: cents,
        original_amount_cents: cents,
        currency_code: 'EUR',
        exchange_rate_to_eur: 1,
        exchange_rate_date: null,
        exchange_rate_source: 'EUR',
        category_id: null,
        date,
        description: `Trasferimento: ${fromName} → ${toName}`,
        recurrence: null,
        transfer_group: group,
      }
      const legs = [
        { ...base, id: crypto.randomUUID(), kind: 'expense', account_id: fromId },
        { ...base, id: crypto.randomUUID(), kind: 'income', account_id: toId },
      ]
      const saveLeg = (leg: (typeof legs)[number]) =>
        mutateOffline('transactions', 'insert', leg.id, leg, {
          ...leg,
          document_id: null,
          created_at: new Date().toISOString(),
        })
      await saveLeg(legs[0])
      try {
        await saveLeg(legs[1])
      } catch (cause) {
        // Niente trasferimenti a metà: se la seconda gamba fallisce, rimuovi la prima.
        await mutateOffline('transactions', 'delete', legs[0].id, {}, null).catch(() => {})
        throw cause
      }
      onSaved()
      onClose()
    } catch {
      setError('Trasferimento non riuscito, riprova.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Trasferimento tra conti">
      <form onSubmit={handleSubmit}>
        <Field label="Dal conto">
          <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={inputClass}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Al conto">
          <select value={toId} onChange={(e) => setToId(e.target.value)} className={inputClass}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Importo (EUR)">
          <input
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputClass} text-2xl font-bold`}
            placeholder="0,00"
          />
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

        {error && <p className="mb-4 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}

        <PrimaryButton type="submit" disabled={busy || fromId === toId}>
          {busy ? <Spinner className="h-5 w-5 text-white" /> : 'Trasferisci'}
        </PrimaryButton>
      </form>
    </Sheet>
  )
}
