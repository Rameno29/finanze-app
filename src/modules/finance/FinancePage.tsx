import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Check, ChevronLeft, ChevronRight, Download, ListX, Mic, Moon, Sparkles, TriangleAlert } from 'lucide-react'
import { EmptyState, PageHeader, Sheet, Spinner } from '../../components/ui'
import { SkeletonRow } from '../../components/Skeleton'
import { TransactionRow } from '../../components/TransactionRow'
import { useNewIds } from '../../components/motion'
import { useIsDesktop } from '../../components/useIsDesktop'
import { useQuickAction } from '../../components/quickActionContext'
import { invokeFunction } from '../../lib/integrations'
import { startVoiceRecording, voiceSupported, type VoiceRecorder } from '../../lib/voice'
import { mutateOffline } from '../../lib/offline'
import { TransactionSheet, type TransactionDraft } from './TransactionSheet'
import { DiarySheet } from './DiarySheet'
import { WhatIfCard } from './WhatIfCard'
import { BudgetsView } from './BudgetsView'
import { CategoriesView } from './CategoriesView'
import { GoalsView } from './GoalsView'
import { AccountsView } from './AccountsView'
import { useAccounts, useBudgets, useCategories, useGoals, useTransactions, sumByKind } from '../../lib/data'
import { exportTransactionsCsv } from '../../lib/exportCsv'
import { formatCents, formatSignedCents, monthLabel, todayISO } from '../../lib/format'
import { dayGroupLabel, groupByDay, lastUpdateLabel } from '../../lib/finance'
import { CategoryIcon } from '../../lib/icons'
import { formatCurrencyCents } from '../../lib/currency'
import type { Transaction } from '../../types'

type View = 'movimenti' | 'budget' | 'obiettivi' | 'conti'

const VIEWS: ReadonlyArray<readonly [View, string]> = [
  ['movimenti', 'Movimenti'],
  ['budget', 'Budget'],
  ['obiettivi', 'Obiettivi'],
  ['conti', 'Conti'],
]

export function FinancePage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const location = useLocation()
  const navigate = useNavigate()
  const routeState = location.state as { view?: View; newAccount?: boolean } | null
  const [view, setView] = useState<View>(routeState?.view && VIEWS.some(([key]) => key === routeState.view) ? routeState.view : 'movimenti')
  const [openNewAccount] = useState(Boolean(routeState?.newAccount))
  useEffect(() => {
    // Lo stato serve solo all'arrivo: si toglie dalla cronologia per non riaprire il foglio.
    if (routeState) navigate(location.pathname, { replace: true, state: null })
  }, [routeState, navigate, location.pathname])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [diaryOpen, setDiaryOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [draft, setDraft] = useState<TransactionDraft | null>(null)

  // Aggiunta rapida a voce o con una frase in linguaggio naturale
  const [quickText, setQuickText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [quickError, setQuickError] = useState('')
  const recorderRef = useRef<VoiceRecorder | null>(null)
  const voiceAbortRef = useRef<AbortController | null>(null)
  const voiceStartingRef = useRef(false)
  const autoStopRef = useRef<number | null>(null)
  const quickInputRef = useRef<HTMLInputElement>(null)

  // "+" della barra e CTA della sidebar: nuovo movimento
  useQuickAction(() => {
    setEditing(null)
    setDraft(null)
    setSheetOpen(true)
  })

  useEffect(() => () => {
    voiceAbortRef.current?.abort()
    if (autoStopRef.current) clearTimeout(autoStopRef.current)
    recorderRef.current?.cancel()
  }, [])

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
      const { data, error } = await invokeFunction('ai-analyze', {
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
      const { data, error } = await invokeFunction('ai-command', {
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
    if (!voiceSupported() || parsing || transcribing || voiceStartingRef.current) return
    voiceStartingRef.current = true
    const controller = new AbortController()
    voiceAbortRef.current = controller
    try {
      recorderRef.current = await startVoiceRecording(controller.signal)
      setListening(true)
      autoStopRef.current = window.setTimeout(() => void stopRec(), 30000)
    } catch {
      setListening(false)
      setQuickError('Non riesco ad accedere al microfono: controlla di aver dato il permesso ad AJE.')
    } finally { voiceStartingRef.current = false }
  }

  const { categories, reload: reloadCategories } = useCategories()
  const { transactions, loading, reload, failed: loadFailed, lastSuccess } = useTransactions(year, month)
  const { budgets, reload: reloadBudgets } = useBudgets()
  const { goals, loading: goalsLoading, reload: reloadGoals } = useGoals()
  const { accounts, loading: accountsLoading, reload: reloadAccounts } = useAccounts()
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')
  const [listError, setListError] = useState('')

  async function handleExport() {
    setExporting(true)
    try {
      const ok = await exportTransactionsCsv()
      setExportMsg(ok ? '' : 'Nessun movimento da esportare.')
      if (!ok) setTimeout(() => setExportMsg(''), 4000)
    } catch {
      setExportMsg('Esportazione non riuscita, riprova.')
    } finally {
      setExporting(false)
    }
  }

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const totals = useMemo(() => sumByKind(transactions), [transactions])

  /** Un trasferimento si elimina intero: entrambi i movimenti collegati. */
  async function deleteTransfer(transferGroup: string) {
    if (!window.confirm('Eliminare il trasferimento? Verranno rimossi entrambi i movimenti collegati.')) return
    try {
      const legs = transactions.filter((t) => t.transfer_group === transferGroup)
      await mutateOffline('transactions', 'delete-transfer', transferGroup, { ids: legs.map(leg => leg.id) }, null)
      setListError('')
      void reload()
    } catch {
      setListError('Eliminazione del trasferimento non riuscita, riprova.')
    }
  }

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  const isDesktop = useIsDesktop()
  const today = todayISO()
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`
  const listReady = !loading && transactions.every((t) => t.date.startsWith(monthPrefix))
  const newIds = useNewIds(transactions.map((t) => t.id), listReady, monthPrefix)
  const viewIndex = VIEWS.findIndex(([key]) => key === view)

  function panelProps(key: View) {
    const active = isDesktop || view === key
    return {
      'data-active': active,
      'aria-hidden': active ? undefined : true,
      inert: !active,
    }
  }

  return (
    <div>
      <PageHeader
        title="Finanze"
        right={
          <div className="flex items-center text-sm text-muted">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Mese precedente"
              className="flex h-11 w-9 items-center justify-center rounded-full"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
            </button>
            <span className="tabular min-w-[7.5rem] text-center">{monthLabel(year, month)}</span>
            <button
              onClick={() => shiftMonth(1)}
              aria-label="Mese successivo"
              className="flex h-11 w-9 items-center justify-center rounded-full"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.9} />
            </button>
          </div>
        }
      />

      {/* Sub-tab mobile */}
      <div className="sticky top-[env(safe-area-inset-top)] z-20 bg-bg lg:hidden">
        <div className="relative grid grid-cols-4 border-b border-line">
          {VIEWS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={`h-12 text-sm transition-colors ${view === key ? 'font-semibold text-ink' : 'font-medium text-muted'}`}
            >
              {label}
            </button>
          ))}
          <span
            aria-hidden="true"
            className="finance-tab-indicator absolute -bottom-px h-0.5 w-1/4 bg-ink"
            style={{ left: `${viewIndex * 25}%` }}
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1120px] overflow-hidden px-5 pt-5 lg:overflow-visible lg:px-10 lg:pt-2">
        {exportMsg && (
          <p role="status" className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{exportMsg}</p>
        )}
        <div className="finance-rail" style={{ '--finance-index': viewIndex } as CSSProperties}>
          {/* Movimenti */}
          <section className="finance-panel finance-panel-main" aria-label="Movimenti" {...panelProps('movimenti')}>
            <h2 className="mb-3 hidden text-[15px] font-semibold lg:block">Movimenti</h2>
            <div className="grid grid-cols-3 border-y border-line py-3">
              {([
                ['Entrate', totals.income, 'text-income'],
                ['Uscite', totals.expense, 'text-ink'],
                ['Saldo', totals.balance, totals.balance >= 0 ? 'text-income' : 'text-expense'],
              ] as const).map(([label, value, tone], index) => (
                <div key={label} className={index ? 'border-l border-line pl-3' : ''}>
                  <p className="text-xs text-muted">{label}</p>
                  <p className={`tabular text-[17px] font-semibold ${tone}`}>{formatCents(value)}</p>
                </div>
              ))}
            </div>

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
                aria-label="Aggiungi con una frase"
                className="h-12 min-w-0 flex-1 rounded-[14px] border border-line bg-card px-4 outline-none focus:border-accent"
                placeholder={
                  listening
                    ? 'Registrando… tocca ✓ per fermare'
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
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] transition disabled:opacity-50 ${
                    listening ? 'animate-pulse bg-expense text-white' : 'bg-card-2 text-ink'
                  }`}
                >
                  {transcribing ? <Spinner className="h-5 w-5" /> : listening ? <Check className="h-5 w-5" /> : <Mic className="h-5 w-5" strokeWidth={1.9} />}
                </button>
              )}
              <button
                type="submit"
                disabled={parsing || listening || transcribing || !quickText.trim()}
                aria-label="Interpreta la frase"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-accent-soft text-accent disabled:opacity-50"
              >
                {parsing ? <Spinner className="h-5 w-5" /> : <Sparkles className="h-5 w-5" strokeWidth={1.9} />}
              </button>
            </form>
            {quickError && (
              <p role="alert" className="mt-2 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{quickError}</p>
            )}

            {/* Diario del giorno: più movimenti in una sola dettatura */}
            <button
              onClick={() => setDiaryOpen(true)}
              className="mt-1 flex min-h-12 w-full items-center gap-2.5 text-left text-sm"
            >
              <Moon className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.9} />
              <span className="flex-1 text-muted">
                <span className="font-semibold text-ink">Diario del giorno</span> — detta tutte le spese in una volta
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.9} aria-hidden="true" />
            </button>

            {listError && (
              <p role="alert" className="mt-2 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{listError}</p>
            )}

            {!loading && loadFailed && transactions.length > 0 && (
              <p role="status" className="mt-3 flex items-center gap-2 rounded-[14px] bg-expense/10 px-4 py-2.5 text-[13px] text-expense">
                <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={1.9} />
                <span className="flex-1">Non riesco ad aggiornare i movimenti: vedi l’ultima copia salvata.</span>
                <button onClick={() => void reload()} className="-my-2 min-h-11 font-semibold underline underline-offset-2">Riprova</button>
              </p>
            )}

            {loading ? (
              <div className="mt-4 space-y-1">
                {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
              </div>
            ) : loadFailed && transactions.length === 0 ? (
              <div role="alert" className="flex flex-col items-center py-12 text-center">
                <TriangleAlert className="h-10 w-10 text-expense" strokeWidth={1.9} aria-hidden="true" />
                <p className="mt-3 text-xl font-semibold">Non riesco a caricare i movimenti</p>
                <p className="mt-1.5 max-w-[300px] text-sm leading-[1.55] text-muted">
                  Il server non risponde. Controlla la connessione e riprova: i dati salvati non si perdono.
                </p>
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="mt-5 min-h-12 rounded-[16px] bg-accent px-8 text-[15px] font-semibold text-white transition active:scale-[0.98]"
                >
                  Riprova
                </button>
                {lastSuccess && (
                  <p className="mt-3 text-[13px] text-muted">Ultimo aggiornamento riuscito: {lastUpdateLabel(lastSuccess)}</p>
                )}
              </div>
            ) : transactions.length === 0 ? (
              <EmptyState
                icon={<ListX />}
                title="Nessun movimento"
                hint={isDesktop
                  ? 'Usa Nuovo movimento per aggiungere la tua prima entrata o uscita.'
                  : 'Tocca il bottone + per aggiungere la tua prima entrata o uscita.'}
              />
            ) : (
              groupByDay(transactions).map((group) => (
                <section key={group.day} className="mt-[18px]" aria-label={dayGroupLabel(group.day, today)}>
                  <h3 className="flex items-baseline justify-between text-[13px]">
                    <span className="font-semibold text-muted">{dayGroupLabel(group.day, today)}</span>
                    <span className="tabular text-muted">
                      {formatSignedCents(Math.abs(group.net), group.net >= 0 ? 'income' : 'expense')}
                    </span>
                  </h3>
                  {group.items.map((t) => {
                    const cat = t.category_id ? categoryById.get(t.category_id) : undefined
                    const account = t.account_id ? accountById.get(t.account_id) : undefined
                    const isTransfer = Boolean(t.transfer_group)
                    const subtitle = [
                      isTransfer ? 'Trasferimento' : (cat?.name ?? 'Senza categoria'),
                      account?.name,
                      t.recurrence,
                    ].filter(Boolean).join(' · ')
                    return (
                      <TransactionRow
                        key={t.id}
                        icon={isTransfer ? <ArrowLeftRight /> : <CategoryIcon icon={cat?.icon ?? 'tag'} />}
                        color={isTransfer ? 'var(--brand)' : (cat?.color ?? '#71717a')}
                        title={t.description || cat?.name || 'Movimento'}
                        subtitle={subtitle}
                        amountCents={t.amount_cents}
                        kind={t.kind}
                        secondary={t.currency_code && t.currency_code !== 'EUR'
                          ? `${formatCurrencyCents(t.original_amount_cents, t.currency_code)} · BCE`
                          : undefined}
                        isNew={newIds.has(t.id)}
                        onClick={() => {
                          if (t.transfer_group) {
                            void deleteTransfer(t.transfer_group)
                            return
                          }
                          setEditing(t)
                          setDraft(null)
                          setSheetOpen(true)
                        }}
                      />
                    )
                  })}
                </section>
              ))
            )}

            <button
              onClick={handleExport}
              disabled={exporting}
              aria-label="Esporta movimenti in CSV"
              title="Esporta CSV/Excel"
              className="mt-6 flex min-h-11 items-center gap-2 text-sm font-medium text-accent disabled:opacity-50"
            >
              {exporting ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" strokeWidth={1.9} />}
              Esporta CSV/Excel
            </button>
          </section>

          {/* Budget */}
          <section className="finance-panel" aria-label="Budget" {...panelProps('budget')}>
            <h2 className="mb-3 hidden text-[15px] font-semibold lg:block">Budget</h2>
            <BudgetsView
              categories={categories}
              budgets={budgets}
              transactions={transactions}
              onChanged={reloadBudgets}
              visible={isDesktop || view === 'budget'}
              onManageCategories={() => setCategoriesOpen(true)}
            />
          </section>

          {/* Obiettivi */}
          <section className="finance-panel" aria-label="Obiettivi" {...panelProps('obiettivi')}>
            <h2 className="mb-3 hidden text-[15px] font-semibold lg:block">Obiettivi</h2>
            <GoalsView goals={goals} loading={goalsLoading} onChanged={reloadGoals} visible={isDesktop || view === 'obiettivi'} />
            <WhatIfCard accounts={accounts} />
          </section>

          {/* Conti */}
          <section className="finance-panel" aria-label="Conti" {...panelProps('conti')}>
            <h2 className="mb-3 hidden text-[15px] font-semibold lg:block">Conti</h2>
            <AccountsView
              accounts={accounts}
              loading={accountsLoading}
              categories={categories}
              onChanged={reloadAccounts}
              onTransactionsChanged={reload}
              openNewAccount={openNewAccount}
            />
          </section>
        </div>
      </div>

      <Sheet open={categoriesOpen} onClose={() => setCategoriesOpen(false)} title="Categorie">
        <CategoriesView categories={categories} onChanged={reloadCategories} />
      </Sheet>

      <DiarySheet
        open={diaryOpen}
        onClose={() => setDiaryOpen(false)}
        categories={categories}
        accounts={accounts}
        onSaved={reload}
      />

      <TransactionSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setDraft(null)
        }}
        categories={categories}
        accounts={accounts}
        editing={editing}
        draft={draft}
      />
    </div>
  )
}
