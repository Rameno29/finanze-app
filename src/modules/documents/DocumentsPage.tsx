import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { FileText, Receipt, ReceiptText, Search, Sparkles, Upload, X } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../../lib/supabase'
import { uploadDocument } from '../../lib/documentUpload'
import { invokeFunction } from '../../lib/integrations'
import { MONTH_NAMES, formatCents } from '../../lib/format'
import { EmptyState, PageHeader, Spinner } from '../../components/ui'
import { Chip } from '../../components/Chip'
import { SkeletonRow } from '../../components/Skeleton'
import { useEstimatedProgress } from '../../components/motion'
import { useIsDesktop } from '../../components/useIsDesktop'
import { PayslipConfirmSheet } from './PayslipConfirmSheet'
import { ReceiptConfirmSheet } from './ReceiptConfirmSheet'
import { ExplainSheet } from './ExplainSheet'
import { GeneratePdfCard } from './GeneratePdfCard'
import { UploadSheet, type DocType, type UploadPhase } from './UploadSheet'
import { useQuickAction } from '../../components/quickActionContext'
import type { DocAnalysis, DocumentRow, Payslip, PayslipAnalysis, ReceiptAnalysis } from '../../types'

const STATUS_CHIP = {
  caricato: { label: 'Caricato', cls: 'bg-card-2 text-muted' },
  analizzato: { label: 'Analizzato', cls: 'bg-brand-soft text-brand' },
  errore: { label: 'Non leggibile', cls: 'bg-expense/14 text-expense' },
} as const

const TYPE_META: Record<DocType, { label: string; mode: string; icon: typeof FileText }> = {
  busta_paga: { label: 'Busta paga', mode: 'payslip', icon: ReceiptText },
  scontrino: { label: 'Scontrino', mode: 'receipt', icon: Receipt },
  altro: { label: 'Documento', mode: 'document', icon: FileText },
}

const FILTERS: Array<{ value: 'tutti' | DocType; label: string }> = [
  { value: 'tutti', label: 'Tutti' },
  { value: 'busta_paga', label: 'Buste paga' },
  { value: 'scontrino', label: 'Scontrini' },
  { value: 'altro', label: 'Altro' },
]

type AnalyzeResult =
  | { ok: true; kind: 'payslip'; analysis: PayslipAnalysis }
  | { ok: true; kind: 'receipt'; analysis: ReceiptAnalysis }
  | { ok: true; kind: 'explain'; analysis: DocAnalysis }
  | { ok: false; message: string }

export function DocumentsPage() {
  const isDesktop = useIsDesktop()
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [payslipData, setPayslipData] = useState<{ doc: DocumentRow; analysis: PayslipAnalysis } | null>(null)
  const [receiptData, setReceiptData] = useState<{ doc: DocumentRow; analysis: ReceiptAnalysis } | null>(null)
  const [explainData, setExplainData] = useState<DocAnalysis | null>(null)
  const [filter, setFilter] = useState<'tutti' | DocType>('tutti')

  // Caricamento: foglio, tipo, fase e file trascinato
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadType, setUploadType] = useState<DocType>('busta_paga')
  const [phase, setPhase] = useState<UploadPhase>({ kind: 'idle' })
  const [uploadError, setUploadError] = useState('')
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const previewUrlRef = useRef<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const uploadTypeRef = useRef<DocType>(uploadType)
  const progress = useEstimatedProgress(phase.kind === 'upload' || phase.kind === 'analyze')

  function chooseType(type: DocType) {
    uploadTypeRef.current = type
    setUploadType(type)
  }

  function openUpload(file: File | null = null) {
    if (phase.kind !== 'upload' && phase.kind !== 'analyze') {
      setPhase({ kind: 'idle' })
      setUploadError('')
    }
    setDroppedFile(file)
    setUploadOpen(true)
  }

  // "+" della barra e CTA della sidebar: apre il foglio di caricamento
  useQuickAction(() => openUpload())

  // Ricerca nei documenti (Full Text Search Postgres, filtrata dalla RLS)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<DocumentRow[] | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const term = searchTerm.trim()
    if (!term) {
      setSearchResults(null)
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = window.setTimeout(async () => {
      const { data, error: searchErr } = await supabase
        .from('documents')
        .select('*')
        .textSearch('search_vector', term, { type: 'websearch', config: 'italian' })
        .order('created_at', { ascending: false })
        .limit(50)
      if (cancelled) return
      setSearchResults(searchErr ? [] : ((data as DocumentRow[]) ?? []))
      setSearching(false)
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchTerm])

  const reload = useCallback(async () => {
    const [docsRes, payslipsRes] = await Promise.all([
      supabase.from('documents').select('*').order('created_at', { ascending: false }),
      supabase.from('payslips').select('*').order('period_year').order('period_month'),
    ])
    if (docsRes.error || payslipsRes.error) {
      setError('Non riesco ad aggiornare l’elenco dei documenti. Controlla la connessione.')
    }
    setDocuments((docsRes.data as DocumentRow[]) ?? [])
    setPayslips((payslipsRes.data as Payslip[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  /** Chiama l'analisi AI; il chiamante decide come mostrarne l'esito. */
  async function runAnalysis(doc: DocumentRow): Promise<AnalyzeResult> {
    setAnalyzingId(doc.id)
    try {
      const { data, error: fnErr } = await invokeFunction('ai-analyze', {
        body: { mode: TYPE_META[doc.doc_type].mode, document_id: doc.id },
      })
      if (fnErr) {
        let detail = ''
        try {
          const ctx = (fnErr as { context?: Response }).context
          if (ctx) detail = (await ctx.json())?.error ?? ''
        } catch {
          /* corpo non JSON */
        }
        await reload()
        return { ok: false, message: detail === 'missing_api_key' ? 'Analisi AI non configurata.' : detail || 'Analisi non riuscita, riprova.' }
      }
      if (doc.doc_type === 'busta_paga') return { ok: true, kind: 'payslip', analysis: data as PayslipAnalysis }
      if (doc.doc_type === 'scontrino') return { ok: true, kind: 'receipt', analysis: data as ReceiptAnalysis }
      await reload()
      return { ok: true, kind: 'explain', analysis: data as DocAnalysis }
    } catch (cause) {
      await reload()
      return { ok: false, message: cause instanceof Error ? cause.message : 'Analisi non riuscita, riprova tra poco.' }
    } finally {
      setAnalyzingId(null)
    }
  }

  function showResult(doc: DocumentRow, result: Extract<AnalyzeResult, { ok: true }>) {
    if (result.kind === 'payslip') setPayslipData({ doc, analysis: result.analysis })
    else if (result.kind === 'receipt') setReceiptData({ doc, analysis: result.analysis })
    else setExplainData(result.analysis)
  }

  /** "Analizza" dall'archivio: come prima, l'esito apre il foglio di conferma o la spiegazione. */
  async function analyzeFromArchive(doc: DocumentRow) {
    setError('')
    const result = await runAnalysis(doc)
    if (result.ok) showResult(doc, result)
    else setError(result.message)
  }

  async function handleUpload(file: File) {
    const docType = uploadTypeRef.current
    setUploadError('')
    const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
    const allowedExtension = /\.(pdf|jpe?g|png|webp)$/i.test(file.name)
    if (!allowedTypes.has(file.type) && !(file.type === '' && allowedExtension)) {
      setUploadError('Formato non supportato: usa PDF, JPEG, PNG o WebP.')
      return
    }
    if (file.size === 0 || file.size > 20 * 1024 * 1024) {
      setUploadError('Il file deve avere una dimensione compresa tra 1 byte e 20 MB.')
      return
    }
    setDroppedFile(null)
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    setPhase({ kind: 'upload' })
    try {
      const doc = await uploadDocument(file, docType)
      await reload()
      setPhase({ kind: 'analyze' })
      const result = await runAnalysis(doc)
      if (!result.ok) {
        if (result.message === 'Analisi AI non configurata.') {
          setPhase({ kind: 'done', title: 'File archiviato', summary: 'La lettura automatica richiede la tua chiave Gemini: il file è nell’archivio e puoi analizzarlo quando l’avrai aggiunta.' })
          return
        }
        // Documento non leggibile: consigli, nuova foto o dati inseriti a mano
        const manual = docType === 'busta_paga'
          ? () => { setUploadOpen(false); setPayslipData({ doc, analysis: { period_year: null, period_month: null, net_cents: null, gross_cents: null, deductions: {}, vacation_days: null, leave_hours: null, employer: null, notes: null } }) }
          : docType === 'scontrino'
            ? () => { setUploadOpen(false); setReceiptData({ doc, analysis: { total_cents: null, date: null, merchant: null, category_hint: null, notes: null } }) }
            : undefined
        setPhase({ kind: 'unreadable', fileName: file.name, previewUrl: previewUrlRef.current, detail: result.message, onManual: manual })
        return
      }
      if (result.kind === 'explain') {
        setPhase({
          kind: 'done',
          title: 'Documento analizzato',
          summary: result.analysis.title || 'La spiegazione è pronta.',
          action: { label: 'Leggi la spiegazione', run: () => { setUploadOpen(false); setExplainData(result.analysis) } },
        })
        return
      }
      // Busta paga e scontrino: si passa ai fogli di conferma esistenti
      setPhase({ kind: 'idle' })
      setUploadOpen(false)
      showResult(doc, result)
    } catch (cause) {
      setPhase({ kind: 'idle' })
      setUploadError(cause instanceof Error ? cause.message : 'Caricamento non riuscito, riprova.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
      if (cameraRef.current) cameraRef.current.value = ''
    }
  }

  // Trascina e rilascia un file sulla pagina (desktop)
  function hasFiles(event: DragEvent) {
    return Array.from(event.dataTransfer.types).includes('Files')
  }

  const chartData = useMemo(
    () =>
      payslips
        .filter((p) => p.net_cents !== null)
        .map((p) => ({
          name: `${MONTH_NAMES[p.period_month - 1].slice(0, 3)} ${String(p.period_year).slice(2)}`,
          Netto: (p.net_cents ?? 0) / 100,
          Lordo: (p.gross_cents ?? 0) / 100,
        })),
    [payslips],
  )

  const searchActive = searchTerm.trim() !== ''
  const baseList = searchActive ? (searchResults ?? []) : documents
  const visibleDocs = filter === 'tutti' ? baseList : baseList.filter((doc) => doc.doc_type === filter)

  return (
    <div
      onDragOver={(event) => {
        if (!isDesktop || !hasFiles(event)) return
        event.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setDragActive(false)
      }}
      onDrop={(event) => {
        if (!isDesktop || !hasFiles(event)) return
        event.preventDefault()
        setDragActive(false)
        const file = event.dataTransfer.files[0]
        if (file) openUpload(file)
      }}
    >
      <PageHeader title="Documenti" subtitle="Buste paga, scontrini e PDF generati" />

      {/* Input sempre nel DOM: file generico e fotocamera posteriore */}
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleUpload(f)
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleUpload(f)
        }}
      />

      <div className="document-layout mx-auto w-full max-w-[1120px] px-5 pt-4 lg:px-10 lg:pt-2">
        <div className="document-generator min-w-0">
          <GeneratePdfCard documents={documents} onSaved={reload} />
        </div>

        <section className="document-archive min-w-0" aria-labelledby="archive-title">
          <div className="flex items-baseline justify-between">
            <h2 id="archive-title" className="text-[15px] font-semibold">Archivio</h2>
            <span className="tabular text-[13px] text-muted">
              {documents.length} {documents.length === 1 ? 'documento' : 'documenti'}
            </span>
          </div>

          <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:px-0">
            {FILTERS.map((item) => (
              <Chip key={item.value} selected={filter === item.value} onClick={() => setFilter(item.value)}>
                {item.label}
              </Chip>
            ))}
          </div>

          {documents.length > 0 && (
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.9} />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                maxLength={200}
                aria-label="Cerca nei documenti"
                className="h-12 w-full rounded-[14px] border border-line bg-card pl-11 pr-11 outline-none focus:border-accent"
                placeholder="Cerca nei documenti (es. bolletta luce)"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  aria-label="Cancella ricerca"
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {error && <p role="alert" className="mt-3 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}

          {analyzingId && !uploadOpen && !payslipData && !receiptData && (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
              <Sparkles className="h-4 w-4 animate-pulse" /> L'AI sta leggendo il documento…
            </p>
          )}

          {loading || (searchActive && searching) ? (
            <div className="mt-3 space-y-1">{[0, 1, 2].map((i) => <SkeletonRow key={i} height={72} />)}</div>
          ) : documents.length === 0 ? (
            <EmptyState
              icon={<FileText />}
              tone="brand"
              title="Nessun documento"
              hint="Carica una busta paga, uno scontrino o un documento qualsiasi: l'AI lo legge per te."
              action="Carica documento"
              onAction={() => openUpload()}
            />
          ) : visibleDocs.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title="Nessun risultato"
              hint={searchActive
                ? "Prova con altre parole: la ricerca guarda nome del file, titolo, riassunto e spiegazione dell'analisi AI."
                : 'Nessun documento di questo tipo.'}
            />
          ) : (
            <div className="mt-2">
              {visibleDocs.map((doc) => {
                const status = STATUS_CHIP[doc.status]
                const type = TYPE_META[doc.doc_type]
                const Icon = type.icon
                const isAnalyzing = analyzingId === doc.id
                const canExplain = doc.doc_type === 'altro' && doc.analysis
                const date = new Date(doc.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
                return (
                  <div key={doc.id} className="flex min-h-[72px] items-center gap-3 border-b border-line">
                    <button
                      onClick={() => canExplain && setExplainData(doc.analysis)}
                      className="flex min-h-[72px] min-w-0 flex-1 items-center gap-3.5 text-left"
                      disabled={!canExplain}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                        <Icon className="h-5 w-5" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{doc.file_name}</span>
                        <span className={`block truncate text-[13px] ${doc.status === 'errore' ? 'text-expense' : 'text-muted'}`}>
                          {doc.status === 'errore' ? 'Analisi non riuscita' : type.label} · {date}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-[10px] px-2 py-1 text-xs font-semibold ${status.cls}`}>{status.label}</span>
                    </button>
                    {doc.status !== 'analizzato' && (
                      <button
                        onClick={() => void analyzeFromArchive(doc)}
                        disabled={isAnalyzing}
                        aria-label={`Analizza ${doc.file_name}`}
                        className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent-soft px-3 text-sm font-semibold text-accent disabled:opacity-60"
                      >
                        {isAnalyzing ? <Spinner className="h-4 w-4" /> : <><Sparkles className="h-4 w-4" strokeWidth={1.9} /> <span className="hidden sm:inline">Analizza</span></>}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {chartData.length > 0 && (
            <section className="mt-8">
              <h3 className="mb-3 text-[15px] font-semibold">Andamento stipendio</h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip
                      formatter={(v) => formatCents(Math.round(Number(v) * 100))}
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                      }}
                      labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
                      itemStyle={{ color: 'var(--muted)' }}
                    />
                    <Line type="monotone" dataKey="Netto" stroke="var(--income)" strokeWidth={2.5} dot />
                    <Line type="monotone" dataKey="Lordo" stroke="var(--accent)" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-income" /> Netto</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /> Lordo</span>
              </div>
            </section>
          )}
        </section>
      </div>

      {dragActive && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-4 z-40 flex items-center justify-center rounded-[28px] border-2 border-dashed border-accent bg-accent-soft/80 lg:left-[280px]">
          <p className="flex items-center gap-2 text-lg font-semibold text-accent">
            <Upload className="h-6 w-6" strokeWidth={1.9} /> Rilascia il file per caricarlo
          </p>
        </div>
      )}

      <UploadSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        type={uploadType}
        onTypeChange={chooseType}
        phase={phase}
        progress={phase.kind === 'done' ? 100 : progress}
        error={uploadError}
        isDesktop={isDesktop}
        droppedFile={droppedFile}
        onPickCamera={() => cameraRef.current?.click()}
        onPickFile={() => fileRef.current?.click()}
        onUploadDropped={() => { if (droppedFile) void handleUpload(droppedFile) }}
      />
      <PayslipConfirmSheet
        data={payslipData}
        onClose={() => setPayslipData(null)}
        onSaved={() => {
          setPayslipData(null)
          void reload()
        }}
      />
      <ReceiptConfirmSheet
        data={receiptData}
        onClose={() => setReceiptData(null)}
        onSaved={() => {
          setReceiptData(null)
          void reload()
        }}
      />
      <ExplainSheet analysis={explainData} onClose={() => setExplainData(null)} />
    </div>
  )
}
