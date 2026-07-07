import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Banknote,
  BookOpenText,
  CircleAlert,
  CircleCheck,
  Clock,
  FileText,
  ReceiptText,
  Sparkles,
} from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../../lib/supabase'
import { MONTH_NAMES, formatCents } from '../../lib/format'
import { Card, EmptyState, PageHeader, Spinner } from '../../components/ui'
import { PayslipConfirmSheet } from './PayslipConfirmSheet'
import { ReceiptConfirmSheet } from './ReceiptConfirmSheet'
import { ExplainSheet } from './ExplainSheet'
import type { DocAnalysis, DocumentRow, Payslip, PayslipAnalysis, ReceiptAnalysis } from '../../types'

type DocType = DocumentRow['doc_type']

const STATUS_META = {
  caricato: { label: 'Da analizzare', icon: Clock, cls: 'text-muted' },
  analizzato: { label: 'Analizzato', icon: CircleCheck, cls: 'text-income' },
  errore: { label: 'Errore analisi', icon: CircleAlert, cls: 'text-expense' },
} as const

const TYPE_META: Record<DocType, { label: string; mode: string }> = {
  busta_paga: { label: 'Busta paga', mode: 'payslip' },
  scontrino: { label: 'Scontrino', mode: 'receipt' },
  altro: { label: 'Documento', mode: 'document' },
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingType, setUploadingType] = useState<DocType | null>(null)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [payslipData, setPayslipData] = useState<{ doc: DocumentRow; analysis: PayslipAnalysis } | null>(null)
  const [receiptData, setReceiptData] = useState<{ doc: DocumentRow; analysis: ReceiptAnalysis } | null>(null)
  const [explainData, setExplainData] = useState<DocAnalysis | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingType = useRef<DocType>('busta_paga')

  const reload = useCallback(async () => {
    const [docsRes, payslipsRes] = await Promise.all([
      supabase.from('documents').select('*').order('created_at', { ascending: false }),
      supabase.from('payslips').select('*').order('period_year').order('period_month'),
    ])
    setDocuments((docsRes.data as DocumentRow[]) ?? [])
    setPayslips((payslipsRes.data as Payslip[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  function pickFile(type: DocType) {
    pendingType.current = type
    fileRef.current?.click()
  }

  async function handleUpload(file: File) {
    const docType = pendingType.current
    setError('')
    setUploadingType(docType)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user!.id
      const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
      if (upErr) throw upErr
      const { data: doc, error: insErr } = await supabase
        .from('documents')
        .insert({ user_id: userId, doc_type: docType, storage_path: path, file_name: file.name })
        .select()
        .single()
      if (insErr) throw insErr
      await reload()
      await analyze(doc as DocumentRow)
    } catch {
      setError('Caricamento non riuscito, riprova.')
    } finally {
      setUploadingType(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function analyze(doc: DocumentRow) {
    setError('')
    setAnalyzingId(doc.id)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('ai-analyze', {
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
        setError(detail === 'missing_api_key' ? 'Analisi AI non configurata.' : detail || 'Analisi non riuscita, riprova.')
        await reload()
        return
      }
      if (doc.doc_type === 'busta_paga') setPayslipData({ doc, analysis: data as PayslipAnalysis })
      else if (doc.doc_type === 'scontrino') setReceiptData({ doc, analysis: data as ReceiptAnalysis })
      else {
        setExplainData(data as DocAnalysis)
        await reload()
      }
    } finally {
      setAnalyzingId(null)
    }
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

  const uploadButtons: Array<{ type: DocType; label: string; hint: string; icon: typeof Banknote; capture?: string }> = [
    { type: 'busta_paga', label: 'Busta paga', hint: 'PDF o foto', icon: Banknote },
    { type: 'scontrino', label: 'Scontrino', hint: 'Scatta o carica', icon: ReceiptText },
    { type: 'altro', label: 'Documento', hint: 'Spiegazione AI', icon: BookOpenText },
  ]

  return (
    <div className="pb-28">
      <PageHeader title="Documenti" subtitle="Analisi AI di buste paga, scontrini e altro" />

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-5 pt-4">
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

        <div className="grid grid-cols-3 gap-2">
          {uploadButtons.map(({ type, label, hint, icon: Icon }) => (
            <button
              key={type}
              onClick={() => pickFile(type)}
              disabled={uploadingType !== null}
              className="flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-accent/50 bg-accent-soft p-2 text-accent transition active:scale-[0.98] disabled:opacity-60"
            >
              {uploadingType === type ? <Spinner /> : <Icon className="h-6 w-6" />}
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-[11px] text-accent/70">{hint}</span>
            </button>
          ))}
        </div>

        {error && <p className="rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}

        {analyzingId && !payslipData && !receiptData && (
          <p className="flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
            <Sparkles className="h-4 w-4 animate-pulse" /> L'AI sta leggendo il documento…
          </p>
        )}

        {chartData.length > 0 && (
          <Card>
            <h2 className="mb-3 font-semibold">Andamento stipendio</h2>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  />
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
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-income" /> Netto
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" /> Lordo
              </span>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title="Nessun documento"
            hint="Carica una busta paga, uno scontrino o un documento qualsiasi: l'AI lo legge per te."
          />
        ) : (
          <Card className="divide-y divide-line p-0">
            {documents.map((doc) => {
              const meta = STATUS_META[doc.status]
              const StatusIcon = meta.icon
              const isAnalyzing = analyzingId === doc.id
              const canExplain = doc.doc_type === 'altro' && doc.analysis
              return (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => canExplain && setExplainData(doc.analysis)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    disabled={!canExplain}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <FileText className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{doc.file_name}</span>
                      <span className={`flex items-center gap-1 text-xs ${meta.cls}`}>
                        <StatusIcon className="h-3.5 w-3.5" /> {TYPE_META[doc.doc_type].label} ·{' '}
                        {meta.label} · {new Date(doc.created_at).toLocaleDateString('it-IT')}
                      </span>
                    </span>
                  </button>
                  {doc.status !== 'analizzato' && (
                    <button
                      onClick={() => analyze(doc)}
                      disabled={isAnalyzing}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isAnalyzing ? (
                        <Spinner className="h-4 w-4 text-white" />
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" /> Analizza
                        </>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </Card>
        )}
      </div>

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
