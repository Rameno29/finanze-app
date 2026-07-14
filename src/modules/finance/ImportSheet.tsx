import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, FileSpreadsheet, TriangleAlert } from 'lucide-react'
import { Field, PrimaryButton, Sheet, Spinner, inputClass } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { currentUserId } from '../../lib/offline'
import {
  guessMapping,
  markDuplicates,
  parseCsv,
  parseEntries,
  readCsvFile,
  suggestCategoryId,
  type ColumnMapping,
  type CsvTable,
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

  const entries = useMemo(
    () => (table && mapping ? parseEntries(table, mapping) : []),
    [table, mapping],
  )
  const duplicates = useMemo(() => markDuplicates(entries, existing), [entries, existing])

  function reset() {
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
    reset()
    onClose()
  }

  async function handleFile(file: File) {
    setError('')
    setImportedCount(null)
    if (!navigator.onLine) {
      setError('Per importare un estratto conto serve la connessione a internet.')
      return
    }
    setBusy(true)
    try {
      const text = await readCsvFile(file)
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
      const dates = firstEntries.map((e) => e.date).filter((d): d is string => d !== null).sort()
      const [existingRes, historyRes] = await Promise.all([
        dates.length > 0
          ? supabase
              .from('transactions')
              .select('date, amount_cents, kind')
              .gte('date', dates[0])
              .lte('date', dates[dates.length - 1])
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('transactions')
          .select('description, category_id, kind')
          .not('category_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(500),
      ])
      setExisting((existingRes.data as ExistingRow[]) ?? [])
      setHistory((historyRes.data as HistoryRow[]) ?? [])
      setTable(parsed)
      setMapping(guessed)
      const dup = markDuplicates(firstEntries, (existingRes.data as ExistingRow[]) ?? [])
      setSelected(new Set(firstEntries.filter((e) => !e.error && !dup.has(e.row)).map((e) => e.row)))
      setCategoryByRow(new Map())
    } catch {
      setError('Lettura del file non riuscita, riprova.')
    } finally {
      setBusy(false)
    }
  }

  function updateMapping(next: ColumnMapping) {
    setMapping(next)
    if (!table) return
    const nextEntries = parseEntries(table, next)
    const dup = markDuplicates(nextEntries, existing)
    setSelected(new Set(nextEntries.filter((e) => !e.error && !dup.has(e.row)).map((e) => e.row)))
    setCategoryByRow(new Map())
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
    if (!account) return
    if (!navigator.onLine) {
      setError('Per importare un estratto conto serve la connessione a internet.')
      return
    }
    const chosen = entries.filter((e) => selected.has(e.row) && !e.error)
    if (chosen.length === 0) {
      setError('Seleziona almeno un movimento da importare.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const userId = await currentUserId()
      const rows = chosen.map((entry) => ({
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
      for (let i = 0; i < rows.length; i += 100) {
        const { error: dbError } = await supabase.from('transactions').insert(rows.slice(i, i + 100))
        if (dbError) throw dbError
      }
      setImportedCount(rows.length)
      onImported()
    } catch {
      setError('Import non riuscito. Alcuni movimenti potrebbero essere già stati salvati: controlla l’elenco prima di riprovare.')
    } finally {
      setBusy(false)
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
                onChange={(e) => updateMapping({ ...mapping!, date: e.target.value === '' ? null : Number(e.target.value) })}
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
                onChange={(e) => updateMapping({ ...mapping!, description: e.target.value === '' ? null : Number(e.target.value) })}
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
                value={mapping?.amount !== null && mapping?.amount !== undefined ? `a:${mapping.amount}` : mapping?.debit !== null && mapping?.credit !== null ? `dc:${mapping!.debit}:${mapping!.credit}` : ''}
                onChange={(e) => {
                  const value = e.target.value
                  if (value.startsWith('a:')) {
                    updateMapping({ ...mapping!, amount: Number(value.slice(2)), debit: null, credit: null })
                  } else if (value.startsWith('dc:')) {
                    const [, debit, credit] = value.split(':')
                    updateMapping({ ...mapping!, amount: null, debit: Number(debit), credit: Number(credit) })
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
                    disabled={Boolean(entry.error)}
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
              className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-card-2 font-semibold"
            >
              Altro file
            </button>
            <PrimaryButton onClick={() => void handleImport()} disabled={busy || selected.size === 0}>
              {busy ? <Spinner className="h-5 w-5 text-white" /> : `Importa ${selected.size}`}
            </PrimaryButton>
          </div>
        </div>
      )}
    </Sheet>
  )
}
