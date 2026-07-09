import { useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Download, ListX, Mic, Plus, Sparkles } from 'lucide-react'
import { PageHeader, Card, EmptyState, Spinner, inputClass } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { startVoiceRecording, voiceSupported, type VoiceRecorder } from '../../lib/voice'
import { TransactionSheet, type TransactionDraft } from './TransactionSheet'
import { BudgetsView } from './BudgetsView'
import { CategoriesView } from './CategoriesView'
import { GoalsView } from './GoalsView'
import { useBudgets, useCategories, useGoals, useTransactions, sumByKind } from '../../lib/data'
import { exportTransactionsCsv } from '../../lib/exportCsv'
import { formatCents, formatDay, monthLabel } from '../../lib/format'
import { CategoryIcon } from '../../lib/icons'
import type { Transaction } from '../../types'

type View = 'movimenti' | 'budget' | 'categorie' | 'obiettivi'

export function FinancePage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [view, setView] = useState<View>('movimenti')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [draft, setDraft] = useState<TransactionDraft | null>(null)

  // Aggiunta rapida a voce o con una frase in linguaggio naturale
  const [quickText, setQuickText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [quickError, setQuickError] = useState('')
  const recorderRef = useRef<VoiceRecorder | null>(null)
  const autoStopRef = useRef<number | null>(null)
  const quickInputRef = useRef<HTMLInputElement>(null)

  interface ParsedTx {
    amount_cents: number | null
    kind: 'income' | 'expense'
    category_name: string | null
    date: string | null
    description: string
  }

  function openDraftFromParsed(parsed: ParsedTx) {
    if (!parsed.amount_cents) {
      setQuickError('Non ho capito l’importo: prova con "20 euro pizza ieri".')
      return
    }
    const cat = parsed.category_name
      ? categories.find(
          (c) => c.kind === parsed.kind && c.name.toLowerCase() === parsed.category_name!.toLowerCase(),
        )
      : undefined
    setDraft({
      kind: parsed.kind,
      amount_cents: parsed.amount_cents,
      category_id: cat?.id ?? null,
      date: parsed.date,
      description: parsed.description,
    })
    setEditing(null)
    setSheetOpen(true)
    setQuickText('')
  }

  async function parseQuick(text: string) {
    const phrase = text.trim()
    if (!phrase || parsing) return
    setParsing(true)
    setQuickError('')
    try {
      const { data, error } = await supabase.functions.invoke('ai-analyze', {
        body: { mode: 'parse_transaction', text: phrase },
      })
      if (error) throw error
      openDraftFromParsed(data as ParsedTx)
    } catch {
      setQuickError('Non sono riuscito a interpretare la frase, riprova.')
    } finally {
      setParsing(false)
    }
  }

  /** Ferma la registrazione, trascrive e mette il testo nel campo (modificabile). */
  async function stopRec() {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
    const rec = recorderRef.current
    recorderRef.current = null
    setListening(false)
    if (!rec) return
    setTranscribing(true)
    setQuickError('')
    try {
      const audio = await rec.stop()
      const { data, error } = await supabase.functions.invoke('ai-command', {
        body: { audio_base64: audio.base64, audio_mime: audio.mime, transcribe_only: true },
      })
      if (error) throw error
      const transcript = ((data as { transcript?: string }).transcript ?? '').trim()
      if (transcript) {
        setQuickText(transcript)
        setTimeout(() => quickInputRef.current?.focus(), 50)
      } else {
        setQuickError('Non ho sentito bene. Riprova avvicinando il microfono e parlando con calma.')
      }
    } catch {
      setQuickError('Trascrizione non riuscita, riprova tra poco.')
    } finally {
      setTranscribing(false)
    }
  }

  async function toggleMic() {
    if (listening) {
      void stopRec()
      return
    }
    if (!voiceSupported() || parsing || transcribing) return
    try {
      recorderRef.current = await startVoiceRecording()
      setListening(true)
      autoStopRef.current = window.setTimeout(() => void stopRec(), 30000)
    } catch {
      setListening(false)
      setQuickError('Non riesco ad accedere al microfono: controlla di aver dato il permesso ad AJE.')
    }
  }

  const { categories, reload: reloadCategories } = useCategories()
  const { transactions, loading, reload } = useTransactions(year, month)
  const { budgets, reload: reloadBudgets } = useBudgets()
  const { goals, loading: goalsLoading, reload: reloadGoals } = useGoals()
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')

  async function handleExport() {
    setExporting(true)
    const ok = await exportTransactionsCsv()
    setExporting(false)
    setExportMsg(ok ? '' : 'Nessun movimento da esportare.')
    if (!ok) setTimeout(() => setExportMsg(''), 4000)
  }

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )
  const totals = useMemo(() => sumByKind(transactions), [transactions])

  const byDay = useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    for (const t of transactions) {
      const list = groups.get(t.date) ?? []
      list.push(t)
      groups.set(t.date, list)
    }
    return Array.from(groups.entries())
  }, [transactions])

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  return (
    <div className="pb-28">
      <PageHeader
        title="Finanze"
        right={
          <button
            onClick={handleExport}
            disabled={exporting}
            aria-label="Esporta movimenti in CSV"
            title="Esporta CSV/Excel"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card-2 text-muted disabled:opacity-50"
          >
            {exporting ? <Spinner className="h-5 w-5" /> : <Download className="h-5 w-5" />}
          </button>
        }
      />

      <div className="mx-auto max-w-lg px-5">
        {exportMsg && (
          <p className="mt-3 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{exportMsg}</p>
        )}
        {/* Selettore vista */}
        <div className="mt-4 grid grid-cols-4 gap-1 rounded-xl bg-card-2 p-1">
          {(
            [
              ['movimenti', 'Movimenti'],
              ['budget', 'Budget'],
              ['categorie', 'Categorie'],
              ['obiettivi', 'Obiettivi'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`min-h-[40px] rounded-lg text-[13px] font-semibold transition ${
                view === key ? 'bg-card shadow text-ink' : 'text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {(view === 'movimenti' || view === 'budget') && (
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Mese precedente"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-card-2"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="font-semibold">{monthLabel(year, month)}</span>
            <button
              onClick={() => shiftMonth(1)}
              aria-label="Mese successivo"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-card-2"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {view === 'movimenti' && (
          <>
            {/* Aggiunta rapida: frase in linguaggio naturale o dettatura vocale */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void parseQuick(quickText)
              }}
              className="mt-4 flex gap-2"
            >
              <input
                ref={quickInputRef}
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                maxLength={300}
                className={inputClass}
                placeholder={
                  listening
                    ? '🔴 Registrando… tocca ✓ per fermare'
                    : transcribing
                      ? 'Trascrivo…'
                      : 'Es: 20 euro pizza ieri sera'
                }
                disabled={listening || transcribing}
              />
              {voiceSupported() && (
                <button
                  type="button"
                  onClick={() => void toggleMic()}
                  disabled={transcribing}
                  aria-label={listening ? 'Ferma e trascrivi' : 'Detta a voce'}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-50 ${
                    listening ? 'animate-pulse bg-expense text-white' : 'bg-card-2 text-muted'
                  }`}
                >
                  {transcribing ? (
                    <Spinner className="h-5 w-5" />
                  ) : listening ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </button>
              )}
              <button
                type="submit"
                disabled={parsing || listening || transcribing || !quickText.trim()}
                aria-label="Interpreta la frase"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-50"
              >
                {parsing ? <Spinner className="h-5 w-5 text-white" /> : <Sparkles className="h-5 w-5" />}
              </button>
            </form>
            {quickError && (
              <p className="mt-2 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{quickError}</p>
            )}

            <Card className="mt-4">
              <div className="grid grid-cols-3 text-center">
                <div>
                  <p className="text-xs text-muted">Entrate</p>
                  <p className="font-bold text-income">{formatCents(totals.income)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Uscite</p>
                  <p className="font-bold text-expense">{formatCents(totals.expense)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Saldo</p>
                  <p className={`font-bold ${totals.balance >= 0 ? 'text-income' : 'text-expense'}`}>
                    {formatCents(totals.balance)}
                  </p>
                </div>
              </div>
            </Card>

            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : transactions.length === 0 ? (
              <EmptyState
                icon={<ListX className="h-10 w-10" />}
                title="Nessun movimento"
                hint="Tocca il bottone + per aggiungere la tua prima entrata o uscita."
              />
            ) : (
              byDay.map(([day, list]) => (
                <section key={day} className="mt-5">
                  <h3 className="mb-2 text-sm font-semibold capitalize text-muted">{formatDay(day)}</h3>
                  <Card className="divide-y divide-line p-0">
                    {list.map((t) => {
                      const cat = t.category_id ? categoryById.get(t.category_id) : undefined
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setEditing(t)
                            setSheetOpen(true)
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left"
                        >
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: cat?.color ?? '#71717a' }}
                          >
                            <CategoryIcon icon={cat?.icon ?? 'tag'} className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {t.description || cat?.name || 'Movimento'}
                            </span>
                            <span className="block text-xs text-muted">
                              {cat?.name ?? 'Senza categoria'}
                              {t.recurrence ? ` · ${t.recurrence}` : ''}
                            </span>
                          </span>
                          <span
                            className={`font-bold ${t.kind === 'income' ? 'text-income' : 'text-expense'}`}
                          >
                            {t.kind === 'income' ? '+' : '−'}{formatCents(t.amount_cents)}
                          </span>
                        </button>
                      )
                    })}
                  </Card>
                </section>
              ))
            )}
          </>
        )}

        {view === 'budget' && (
          <BudgetsView
            categories={categories}
            budgets={budgets}
            transactions={transactions}
            onChanged={reloadBudgets}
          />
        )}

        {view === 'categorie' && (
          <CategoriesView categories={categories} onChanged={reloadCategories} />
        )}

        {view === 'obiettivi' && (
          <GoalsView goals={goals} loading={goalsLoading} onChanged={reloadGoals} />
        )}
      </div>

      {/* FAB nuovo movimento */}
      {view === 'movimenti' && (
        <button
          onClick={() => {
            setEditing(null)
            setDraft(null)
            setSheetOpen(true)
          }}
          aria-label="Nuovo movimento"
          className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-xl transition active:scale-95"
        >
          <Plus className="h-7 w-7" />
        </button>
      )}

      <TransactionSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setDraft(null)
        }}
        onSaved={reload}
        categories={categories}
        editing={editing}
        draft={draft}
      />
    </div>
  )
}
