import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Clock, FileText, FileUp, Sparkles } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../../lib/supabase'
import { MONTH_NAMES, formatCents } from '../../lib/format'
import { Card, EmptyState, PageHeader, Spinner } from '../../components/ui'
import { PayslipConfirmSheet } from './PayslipConfirmSheet'
import type { DocumentRow, Payslip, PayslipAnalysis } from '../../types'

const STATUS_META = {
  caricato: { label: 'Da analizzare', icon: Clock, cls: 'text-muted' },
  analizzato: { label: 'Analizzato', icon: CircleCheck, cls: 'text-income' },
  errore: { label: 'Errore analisi', icon: CircleAlert, cls: 'text-expense' },
} as const

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [confirmData, setConfirmData] = useState<{ doc: DocumentRow; analysis: PayslipAnalysis } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    const [docsRes, payslipsRes] = await Promise.all([
      supabase.from('documents').select('*').order('created_at', { ascending: false }),
      supabase
        .from('payslips')
        .select('*')
        .order('period_year')
        .order('period_month'),
    ])
    setDocuments((docsRes.data as DocumentRow[]) ?? [])
    setPayslips((payslipsRes.data as Payslip[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleUpload(file: File) {
    setError('')
    setUploading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user!.id
      const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
      if (upErr) throw upErr
      const { data: doc, error: insErr } = await supabase
        .from('documents')
        .insert({ user_id: userId, doc_type: 'busta_paga', storage_path: path, file_name: file.name })
        .select()
        .single()
      if (insErr) throw insErr
      await reload()
      await analyze(doc as DocumentRow)
    } catch {
      setError('Caricamento non riuscito, riprova.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function analyze(doc: DocumentRow) {
    setError('')
    setAnalyzingId(doc.id)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('analyze-payslip', {
        body: { document_id: doc.id },
      })
      if (fnErr) {
        let detail = ''
        try {
          const ctx = (fnErr as { context?: Response }).context
          if (ctx) detail = (await ctx.json())?.error ?? ''
        } catch { /* corpo non JSON */ }
        if (detail === 'missing_api_key') {
          setError(
            'Analisi AI non ancora configurata: serve la chiave API Anthropic nelle impostazioni del server (vedi scheda Altro → Analisi AI).',
          )
        } else {
          setError(detail || 'Analisi non riuscita, riprova.')
        }
        await reload()
        return
      }
      setConfirmData({ doc, analysis: data as PayslipAnalysis })
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

  return (
    <div className="pb-28">
      <PageHeader title="Documenti" subtitle="Buste paga e analisi AI" />

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-5 pt-4">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleUpload(f)
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex min-h-[80px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-accent/50 bg-accent-soft font-semibold text-accent transition active:scale-[0.99] disabled:opacity-60"
        >
          {uploading ? (
            <Spinner />
          ) : (
            <>
              <FileUp className="h-6 w-6" />
              Carica busta paga (PDF o foto)
            </>
          )}
        </button>

        {error && <p className="rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}

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
                  <Tooltip formatter={(v) => formatCents(Math.round(Number(v) * 100))} />
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
            hint="Carica la tua prima busta paga: l'AI estrae netto, lordo e trattenute e crea l'entrata nelle finanze."
          />
        ) : (
          <Card className="divide-y divide-line p-0">
            {documents.map((doc) => {
              const meta = STATUS_META[doc.status]
              const StatusIcon = meta.icon
              const isAnalyzing = analyzingId === doc.id
              return (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <FileText className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{doc.file_name}</span>
                    <span className={`flex items-center gap-1 text-xs ${meta.cls}`}>
                      <StatusIcon className="h-3.5 w-3.5" /> {meta.label} ·{' '}
                      {new Date(doc.created_at).toLocaleDateString('it-IT')}
                    </span>
                  </span>
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
        data={confirmData}
        onClose={() => setConfirmData(null)}
        onSaved={() => {
          setConfirmData(null)
          void reload()
        }}
      />
    </div>
  )
}
