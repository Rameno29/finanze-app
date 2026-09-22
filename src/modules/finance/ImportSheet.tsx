import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, FileSpreadsheet, TriangleAlert } from 'lucide-react'
import { Field, PrimaryButton, Sheet, Spinner, inputClass } from '../../components/ui'
import { authenticatedClient, supabase } from '../../lib/supabase'
import { sessionScope } from '../../lib/sessionScope'
import { readAllPages } from '../../lib/pagination'
import {
  guessMapping,
  markDuplicates,
  parseCsv,
  parseEntries,
  readCsvFile,
  suggestCategoryId,
  type ColumnMapping,
  type CsvTable,
  type ImportEntry,
} from '../../lib/csvImport'
import { formatCents } from '../../lib/format'
import type { Account, Category, Transaction } from '../../types'

type HistoryRow = Pick<Transaction, 'description' | 'category_id' | 'kind'>
type ExistingRow = Pick<Transaction, 'date' | 'amount_cents' | 'kind'>

/**
 * Import guidato di un estratto conto CSV su un conto: anteprima, mappatura
 * colonne modificabile, possibili duplicati deselezionati, categoria proposta
 * dallo storico e modificabile riga per riga. Il file resta sul dispositivo.
 */
export function ImportSheet({
  open,
  onClose,
  account,
  categories,
  onImported,
}: {
  open: boolean
  onClose: () => void
  account: Account | null
  categories: Category[]
  onImported: () => void
}) {
  const [table, setTable] = useState<CsvTable | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [existing, setExisting] = useState<ExistingRow[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [categoryByRow, setCategoryByRow] = useState<Map<number, string>>(new Map())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const working = useRef(false)
  const batch = useRef<Array<Record<string, unknown>> | null>(null)
  const [retrying, setRetrying] = useState(false)

  const entries = useMemo(
    () => (table && mapping ? parseEntries(table, mapping) : []),
    [table, mapping],
  )
  const duplicates = useMemo(() => markDuplicates(entries, existing), [entries, existing])

  function reset() {
    if (working.current) return
    batch.current = null
    setRetrying(false)
    setTable(null)
    setMapping(null)
    setHistory([])
    setExisting([])
    setSelected(new Set())
    setCategoryByRow(new Map())
    setBusy(false)
    setError('')
    setImportedCount(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function close() {
    if (working.current) return
    reset()
    onClose()
  }

  async function importClient(ticket: ReturnType<typeof sessionScope.capture>) {
    const { data, error: authError } = await supabase.auth.getSession()
    sessionScope.assert(ticket)
    if (authError || data.session?.user.id !== ticket.userId || account?.user_id !== ticket.userId) throw new Error('Sessione cambiata.')
    return authenticatedClient(data.session.access_token)
  }

  /** Movimenti già registrati nell'intervallo di date del file, per i duplicati. */
  async function fetchExisting(entriesList: ImportEntry[]): Promise<ExistingRow[]> {
    const ticket = sessionScope.capture()
    const dates = entriesList.map((e) => e.date).filter((d): d is string => d !== null).sort()
    if (dates.length === 0) return []
    const client = await importClient(ticket)
    return readAllPages<ExistingRow>(async (from, to) => {
      sessionScope.assert(ticket)
      const result = await client
      .from('transactions')
      .select('date, amount_cents, kind')
      .eq('user_id', ticket.userId)
      .eq('account_id', account!.id)
      .gte('date', dates[0])
      .lte('date', dates[dates.length - 1])
      .order('id').range(from, to)
      sessionScope.assert(ticket)
      return result
    })
  }

  function applyEntries(entriesList: ImportEntry[], existingList: ExistingRow[]) {
    setExisting(existingList)
    const dup = markDuplicates(entriesList, existingList)
    setSelected(new Set(entriesList.filter((e) => !e.error && !dup.has(e.row)).map((e) => e.row)))
    setCategoryByRow(new Map())
  }

  async function handleFile(file: File) {
    if (working.current) return
    setError('')
    setImportedCount(null)
    if (!navigator.onLine) {
      setError('Per importare un estratto conto serve la connessione a internet.')
      return
    }
    working.current = true; setBusy(true)
    try {
      const ticket = sessionScope.capture()
      const text = await readCsvFile(file)
      sessionScope.assert(ticket)
      const parsed = parseCsv(text)
      if (parsed.header.length < 2 || parsed.rows.length === 0) {
        setError('File non riconosciuto: serve un CSV con intestazione e almeno una riga.')
        return
      }
      if (parsed.rows.length > 2000) {
        setError('Il file ha più di 2000 righe: dividilo in file più piccoli.')
        return
      }
      const guessed = guessMapping(parsed.header)
      const firstEntries = parseEntries(parsed, guessed)
      const client = await importClient(ticket)
      const [existingList, historyRes] = await Promise.all([
        fetchExisting(firstEntries),
        client
          .from('transactions')
          .select('description, category_id, kind')
          .eq('user_id', ticket.userId)
          .not('category_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(500),
      ])
      sessionScope.assert(ticket)
      if (historyRes.error) throw historyRes.error
      setHistory((historyRes.data as HistoryRow[]) ?? [])
      setTable(parsed)
      setMapping(guessed)
      applyEntries(firstEntries, existingList)
    } catch {
      setError('Lettura del file non riuscita, riprova.')
    } finally {
      working.current = false; setBusy(false)
    }
  }

  async function updateMapping(next: ColumnMapping) {
    if (!table || working.current || batch.current) return
    working.current = true; setBusy(true); setError(''); setSelected(new Set())
    setMapping(next)
    try {
      const nextEntries = parseEntries(table, next)
      applyEntries(nextEntries, await fetchExisting(nextEntries))
    } catch { setError('Verifica dei movimenti non riuscita. Riprova la selezione delle colonne prima di importare.') }
    finally { working.current = false; setBusy(false) }
  }

  function toggleRow(row: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(row)) next.delete(row)
      else next.add(row)
      return next
    })
  }

  const suggestions = useMemo(() => {
    const map = new Map<number, string | null>()
    for (const entry of entries) {
      if (entry.error || !entry.kind) continue
      map.set(entry.row, suggestCategoryId(entry.description, entry.kind, history))
    }
    return map
  }, [entries, history])

  async function handleImport() {
    if (!account || working.current) return
    if (!navigator.onLine) {
      setError('Per importare un estratto conto serve la connessione a internet.')
      return
    }
    const chosen = entries.filter((e) => selected.has(e.row) && !e.error)
    if (chosen.length === 0) {
      setError('Seleziona almeno un movimento da importare.')
      return
    }
    working.current = true; setBusy(true)
    setError('')
    try {
      const ticket = sessionScope.capture()
      const client = await importClient(ticket)
      const userId = ticket.userId
      const rows = batch.current ?? chosen.map((entry) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        amount_cents: entry.amount_cents!,
        original_amount_cents: entry.amount_cents!,
        currency_code: 'EUR',
        exchange_rate_to_eur: 1,
        exchange_rate_date: null,
        exchange_rate_source: 'EUR',
        kind: entry.kind!,
        category_id: (categoryByRow.has(entry.row)
          ? categoryByRow.get(entry.row) || null
          : suggestions.get(entry.row)) ?? null,
        date: entry.date!,
        description: entry.description.slice(0, 200),
        recurrence: null,
        account_id: account.id,
      }))
      batch.current = rows
      const requireActive = async () => {
        const member = await client.from('app_members').select('status').eq('user_id', userId).maybeSingle()
        sessionScope.assert(ticket)
        if (member.error || member.data?.status !== 'active') throw new Error('Accesso non abilitato.')
      }
      await requireActive()
      // One statement commits all selected rows together. Stable IDs/content on
      // retry prevent duplicates without overwriting already committed rows.
      const { error: dbError } = await client.from('transactions').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      sessionScope.assert(ticket)
      if (dbError) throw dbError
      await requireActive()
      setImportedCount(rows.length)
      onImported()
    } catch {
      setRetrying(batch.current !== null)
      setError('Import non riuscito o risposta non ricevuta. Riprova qui senza duplicare i movimenti: la selezione resta bloccata fino al nuovo tentativo. Se chiudi, ricarica il file per ricontrollare i duplicati.')
    } finally {
      working.current = false; setBusy(false)
    }
  }

  const columnOptions = (table?.header ?? []).map((h, i) => [i, h || `Colonna ${i + 1}`] as const)
  const validCount = entries.filter((e) => !e.error).length
  const categoriesByKind = useMemo(
    () => ({
      expense: categories.filter((c) => c.kind === 'expense'),
      income: categories.filter((c) => c.kind === 'income'),
    }),
    [categories],
  )

  return (
    <Sheet open={open} onClose={close} title={`Importa CSV · ${account?.name ?? ''}`}>
      {importedCount !== null ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-income" />
          <p className="font-semibold">{importedCount} movimenti importati su {account?.name}</p>
          <PrimaryButton onClick={close}>Chiudi</PrimaryButton>
        </div>
      ) : !table ? (
        <div className="pb-4">
          <p className="mb-4 text-sm text-muted">
            Scarica l’estratto conto in formato CSV dal sito della tua banca e caricalo qui:
            vedrai l’anteprima e potrai scegliere cosa importare. Il file non viene inviato a nessun server.
          </p>
          <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-card-2 p-6 text-center">
            <FileSpreadsheet className="h-8 w-8 text-accent" />
            <span className="font-semibold">Scegli il file CSV</span>
            <span className="text-xs text-muted">Formati: CSV con ; o , — max 2000 righe</span>
            <input
              ref={fileRef}
              type="file"
              disabled={busy}
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
              }}
            />
          </label>
          {busy && (
            <div className="mt-4 flex justify-center">
              <Spinner />
            </div>
          )}
          {error && <p className="mt-4 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}
        </div>
      ) : (
        <div className="pb-4">
          {/* Mappatura colonne, precompilata e modificabile */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Colonna data">
              <select
                value={mapping?.date ?? ''}
                disabled={busy || retrying}
                onChange={(e) => void updateMapping({ ...mapping!, date: e.target.value === '' ? null : Number(e.target.value) })}
                className={inputClass}
              >
                <option value="">—</option>
                {columnOptions.map(([i, label]) => (
                  <option key={i} value={i}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="Colonna descrizione">
              <select
                value={mapping?.description ?? ''}
                disabled={busy || retrying}
                onChange={(e) => void updateMapping({ ...mapping!, description: e.target.value === '' ? null : Number(e.target.value) })}
                className={inputClass}
              >
                <option value="">—</option>
                {columnOptions.map(([i, label]) => (
                  <option key={i} value={i}>{label}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Importo">
            <div className="grid grid-cols-1 gap-2">
              <select
                disabled={busy || retrying}
                value={mapping?.amount !== null && mapping?.amount !== undefined ? `a:${mapping.amount}` : mapping?.debit !== null && mapping?.credit !== null ? `dc:${mapping!.debit}:${mapping!.credit}` : ''}
                onChange={(e) => {
                  const value = e.target.value
                  if (value.startsWith('a:')) {
                    void updateMapping({ ...mapping!, amount: Number(value.slice(2)), debit: null, credit: null })
                  } else if (value.startsWith('dc:')) {
                    const [, debit, credit] = value.split(':')
                    void updateMapping({ ...mapping!, amount: null, debit: Number(debit), credit: Number(credit) })
                  }
                }}
                className={inputClass}
              >
                <option value="">—</option>
                {columnOptions.map(([i, label]) => (
                  <option key={`a${i}`} value={`a:${i}`}>Unica colonna: {label}</option>
                ))}
                {columnOptions.flatMap(([i, di]) =>
                  columnOptions
                    .filter(([j]) => j !== i)
                    .map(([j, cj]) => (
                      <option key={`dc${i}-${j}`} value={`dc:${i}:${j}`}>
                        Uscite: {di} + Entrate: {cj}
                      </option>
                    )),
                )}
              </select>
            </div>
          </Field>

          <p className="mb-2 text-sm text-muted">
            {validCount} movimenti riconosciuti su {entries.length} righe · {selected.size} selezionati
            {duplicates.size > 0 && ` · ${duplicates.size} possibili duplicati (deselezionati)`}
          </p>

          <div className="max-h-[38vh] overflow-y-auto rounded-2xl border border-line">
            {entries.map((entry) => {
              const isDuplicate = duplicates.has(entry.row)
              const categoryValue = categoryByRow.get(entry.row) ?? suggestions.get(entry.row) ?? ''
              return (
                <div
                  key={entry.row}
                  className={`flex items-center gap-2 border-b border-line px-3 py-2 last:border-b-0 ${
                    entry.error ? 'opacity-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(entry.row)}
                    disabled={Boolean(entry.error) || busy || retrying}
                    onChange={() => toggleRow(entry.row)}
                    aria-label={`Importa riga ${entry.row + 1}`}
                    className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {entry.description || '(senza descrizione)'}
                    </p>
                    <p className="text-xs text-muted">
                      {entry.error ? (
                        <span className="text-expense">{entry.error}</span>
                      ) : (
                        <>
                          {entry.date}
                          {isDuplicate && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-amber-600">
                              <TriangleAlert className="h-3 w-3" /> possibile duplicato
                            </span>
                          )}
                        </>
                      )}
                    </p>
                    {!entry.error && entry.kind && (
                      <select
                        value={categoryValue}
                        disabled={busy || retrying}
                        onChange={(e) =>
                          setCategoryByRow((prev) => new Map(prev).set(entry.row, e.target.value))
                        }
                        className="mt-1 w-full rounded-lg border border-line bg-card-2 px-2 py-1 text-xs"
                      >
                        <option value="">Senza categoria</option>
                        {categoriesByKind[entry.kind].map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {!entry.error && entry.amount_cents !== null && (
                    <span
                      className={`shrink-0 text-sm font-bold ${
                        entry.kind === 'income' ? 'text-income' : 'text-expense'
                      }`}
                    >
                      {entry.kind === 'income' ? '+' : '−'}{formatCents(entry.amount_cents)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {error && <p className="mt-4 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={reset}
              disabled={busy || retrying}
              className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-card-2 font-semibold"
            >
              Altro file
            </button>
            <PrimaryButton onClick={() => void handleImport()} disabled={busy || selected.size === 0}>
              {busy ? <Spinner className="h-5 w-5 text-white" /> : retrying ? 'Riprova importazione' : `Importa ${selected.size}`}
            </PrimaryButton>
          </div>
        </div>
      )}
    </Sheet>
  )
}
