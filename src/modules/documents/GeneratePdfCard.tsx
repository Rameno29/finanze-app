import { useEffect, useId, useRef, useState, type ComponentType } from 'react'
import { Download, FilePlus2, FolderOpen, PenLine, RotateCcw, Sparkles, SquarePlay, X } from 'lucide-react'
import { Spinner } from '../../components/ui'
import { prefersReducedMotion, useEstimatedProgress } from '../../components/motion'
import { invokeFunction } from '../../lib/integrations'
import { createPdfBlob, downloadPdf, pdfFileName, validateGeneratedDoc, type GeneratedDoc } from '../../lib/pdf'
import { uploadDocument } from '../../lib/documentUpload'
import type { DocumentRow } from '../../types'

type Source = 'text' | 'youtube' | 'document'
type Format = 'sintesi' | 'appunti' | 'schema'

const SOURCES: Array<{ value: Source; title: string; hint: string; icon: ComponentType<{ className?: string; strokeWidth?: number }> }> = [
  { value: 'text', title: 'Testo scritto', hint: 'Incolla appunti o un articolo', icon: PenLine },
  { value: 'youtube', title: 'Video YouTube pubblico', hint: 'Incolla il link di un video pubblico', icon: SquarePlay },
  { value: 'document', title: 'Documento archiviato', hint: 'Scegli un file dal tuo archivio', icon: FolderOpen },
]

const FORMATS: Array<{ value: Format; label: string }> = [
  { value: 'sintesi', label: 'Sintesi' },
  { value: 'appunti', label: 'Appunti' },
  { value: 'schema', label: 'Schema' },
]

const STEPS = ['Fonte', 'Formato', 'Genera', 'Anteprima']
const STATUS_MESSAGES = ['Leggo la fonte…', 'Scrivo le sezioni…', 'Controllo il risultato…']

const fieldClass = 'w-full rounded-[14px] border border-line bg-card px-4 outline-none focus:border-accent'

export function GeneratePdfCard({ documents, onSaved }: { documents: DocumentRow[]; onSaved: () => Promise<void> }) {
  const headingId = useId()
  const [source, setSource] = useState<Source>('text')
  const [format, setFormat] = useState<Format>('appunti')
  const [prompt, setPrompt] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [documentId, setDocumentId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState<GeneratedDoc | null>(null)
  const generationId = useRef(0)
  const progress = useEstimatedProgress(generating)
  const previewRef = useRef<HTMLDivElement>(null)
  const hasPreview = generated !== null

  // Appena pronta, l'anteprima scorre in vista (su mobile sarebbe sotto il bordo dello schermo).
  useEffect(() => {
    if (!hasPreview) return
    previewRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }, [hasPreview])

  function changeInput(update: () => void) {
    generationId.current += 1
    update()
    setGenerating(false)
    setGenerated(null)
    setSaved(false)
    setError('')
  }

  function changeSource(next: Source) {
    changeInput(() => setSource(next))
  }

  async function generate() {
    setError('')
    setGenerated(null)
    setSaved(false)
    const body: Record<string, unknown> = { mode: 'generate', source, format, prompt: prompt.trim() }
    if (source === 'text' && !prompt.trim()) { setError('Scrivi il testo o le istruzioni da trasformare in PDF.'); return }
    if (source === 'youtube') {
      if (!videoUrl.trim()) { setError('Inserisci un link YouTube pubblico.'); return }
      body.video_url = videoUrl.trim()
    }
    if (source === 'document') {
      if (!documentId) { setError('Scegli un documento del tuo archivio.'); return }
      body.document_id = documentId
    }
    const requestId = ++generationId.current
    setGenerating(true)
    try {
      const { data, error: functionError } = await invokeFunction<GeneratedDoc>('ai-analyze', { body })
      if (requestId !== generationId.current) return
      if (functionError) throw functionError
      setGenerated(validateGeneratedDoc(data))
    } catch (cause) {
      if (requestId !== generationId.current) return
      const detail = cause instanceof Error ? cause.message : 'Generazione non riuscita.'
      setError(source === 'youtube' && detail.startsWith('Chiave non valida')
        ? 'La chiave Gemini potrebbe non essere valida oppure il video non è accessibile. Controlla entrambi e riprova.'
        : detail)
    } finally {
      if (requestId === generationId.current) setGenerating(false)
    }
  }

  function validPreview(): GeneratedDoc | null {
    try { return validateGeneratedDoc(generated) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Completa l’anteprima.'); return null }
  }

  function download() {
    const doc = validPreview()
    if (!doc) return
    setError('')
    downloadPdf(doc)
  }

  async function save() {
    const doc = validPreview()
    if (!doc) return
    setError('')
    setSaving(true)
    try {
      const blob = createPdfBlob(doc)
      if (blob.size > 20 * 1024 * 1024) throw new Error('Il PDF supera 20 MB: accorcia il documento prima di salvarlo.')
      await uploadDocument(new File([blob], pdfFileName(doc), { type: 'application/pdf' }), 'altro')
      await onSaved()
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Salvataggio non riuscito.')
    } finally {
      setSaving(false)
    }
  }

  function restart() {
    changeInput(() => {
      setPrompt('')
      setVideoUrl('')
      setDocumentId('')
    })
  }

  function editTitle(title: string) {
    setGenerated(current => current ? { ...current, title } : current)
    setSaved(false)
  }
  function editSection(index: number, key: 'heading' | 'body', value: string) {
    setGenerated(current => current ? { ...current, sections: current.sections.map((section, i) => i === index ? { ...section, [key]: value } : section) } : current)
    setSaved(false)
  }

  const sourceReady = source === 'text' ? Boolean(prompt.trim()) : source === 'youtube' ? Boolean(videoUrl.trim()) : Boolean(documentId)
  const step = generated ? 3 : generating ? 2 : sourceReady ? 1 : 0
  const formatLabel = FORMATS.find((item) => item.value === format)?.label ?? format

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-[15px] font-semibold">Crea un documento PDF</h2>

      {/* Indicatore dei passi */}
      <ol className="mt-3 grid grid-cols-4 gap-1.5" aria-label="Passi">
        {STEPS.map((label, index) => (
          <li key={label} aria-current={index === step ? 'step' : undefined}>
            <span className="block h-1 overflow-hidden rounded-sm bg-line">
              <span className="pdf-step-fill block h-full bg-accent" style={{ width: index <= step ? '100%' : '0%' }} />
            </span>
            <span className={`mt-1.5 block text-xs ${index === step ? 'font-semibold text-ink' : 'text-muted'}`}>{label}</span>
          </li>
        ))}
      </ol>

      {/* Passo 1: fonte (il select resta il controllo collegato, nascosto alla vista) */}
      <label htmlFor="pdf-source" className="sr-only">Fonte</label>
      <select id="pdf-source" aria-hidden="true" tabIndex={-1} value={source} onChange={event => changeSource(event.target.value as Source)} className="sr-only">
        <option value="text">Testo scritto</option><option value="youtube">Video YouTube pubblico</option><option value="document">Documento archiviato</option>
      </select>
      <div role="radiogroup" aria-label="Origine del contenuto" className="mt-3">
        {SOURCES.map(({ value, title, hint, icon: Icon }) => {
          const checked = source === value
          return (
            <label key={value} className="flex min-h-16 cursor-pointer items-center gap-3.5 border-b border-line">
              <Icon className="h-5 w-5 shrink-0 text-brand" strokeWidth={1.9} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{title}</span>
                <span className="block text-[13px] text-muted">{hint}</span>
              </span>
              <input type="radio" name="pdf-source-choice" value={value} checked={checked} onChange={() => changeSource(value)} className="peer sr-only" />
              <span aria-hidden="true" className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] peer-focus-visible:outline-3 peer-focus-visible:outline-accent/60 ${checked ? 'border-accent' : 'border-line'}`}>
                {checked && <span className="pdf-radio-dot h-3 w-3 rounded-full bg-accent" />}
              </span>
            </label>
          )
        })}
      </div>

      <div className="mt-4">
        {source === 'youtube' && <>
          <label className="mb-1.5 block text-sm font-medium text-muted" htmlFor="pdf-video">Link YouTube</label>
          <input id="pdf-video" type="url" value={videoUrl} onChange={event => changeInput(() => setVideoUrl(event.target.value))} className={`${fieldClass} mb-3 h-12`} placeholder="https://www.youtube.com/watch?v=…" />
        </>}
        {source === 'document' && <>
          <label className="mb-1.5 block text-sm font-medium text-muted" htmlFor="pdf-document">Documento dell’archivio</label>
          <select id="pdf-document" value={documentId} onChange={event => changeInput(() => setDocumentId(event.target.value))} className={`${fieldClass} mb-3 h-12`}>
            <option value="">Seleziona un documento</option>
            {documents.map(doc => <option key={doc.id} value={doc.id}>{doc.file_name}</option>)}
          </select>
        </>}
        <label className="mb-1.5 block text-sm font-medium text-muted" htmlFor="pdf-prompt">{source === 'text' ? 'Testo o istruzioni' : 'Istruzioni aggiuntive (facoltative)'}</label>
        <textarea id="pdf-prompt" value={prompt} onChange={event => changeInput(() => setPrompt(event.target.value))} maxLength={2000} className={`${fieldClass} min-h-[90px] resize-y py-3`} placeholder={source === 'text' ? 'Es. Spiega come organizzare un budget mensile…' : 'Es. Evidenzia i concetti finanziari principali'} />
      </div>

      {/* Passo 2: formato */}
      <p className="mt-5 mb-2 text-sm font-medium text-muted" aria-hidden="true">Formato</p>
      <label htmlFor="pdf-format" className="sr-only">Formato</label>
      <select id="pdf-format" aria-hidden="true" tabIndex={-1} value={format} onChange={event => changeInput(() => setFormat(event.target.value as Format))} className="sr-only">
        {FORMATS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <div role="group" aria-label="Stile del documento" className="flex flex-wrap gap-2">
        {FORMATS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={format === item.value}
            onClick={() => changeInput(() => setFormat(item.value))}
            className={`min-h-10 rounded-full border px-4 text-sm font-medium transition-colors duration-[250ms] ${
              format === item.value ? 'border-ink bg-ink text-bg' : 'border-line text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Passo 3: genera */}
      <div className="mt-5">
        {generating && (
          <div className="mb-4" role="status" aria-live="polite">
            <p className="tabular text-[44px] font-semibold leading-none tracking-[-0.03em]">{progress}%</p>
            <p className="mt-2 text-sm text-muted">{STATUS_MESSAGES[Math.min(STATUS_MESSAGES.length - 1, Math.floor(progress / 35))]}</p>
            <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-card-2">
              <span className="block h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${progress}%` }} />
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-accent text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {generating ? <><Spinner className="h-5 w-5 text-white" /> L’AI sta scrivendo…</> : <><Sparkles className="h-5 w-5" strokeWidth={1.9} /> Genera documento</>}
        </button>
        <p className="mt-2 text-[13px] text-muted">Controlla sempre il risultato dell’AI prima di usarlo.</p>
      </div>
      {error && !generated && <p role="alert" className="mt-3 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}

      {/* Passo 4: anteprima modificabile */}
      {generated && (
        <div ref={previewRef} className="mt-7 scroll-mt-4">
          <h3 className="mb-3 text-[15px] font-semibold">Anteprima PDF</h3>
          <div className="pdf-paper relative rounded-md bg-[#fffefa] px-5 py-[22px] text-[#152c29] shadow-[var(--shadow-paper)]">
            <button
              type="button"
              onClick={() => setGenerated(null)}
              aria-label="Chiudi"
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-[#5c6b67]"
            >
              <X className="h-5 w-5" strokeWidth={1.9} />
            </button>
            <p className="pr-10 text-xs text-[#5c6b67]">{formatLabel} · generato da AJE</p>
            <label className="sr-only" htmlFor="pdf-title">Titolo</label>
            <input
              id="pdf-title"
              value={generated.title}
              onChange={event => editTitle(event.target.value)}
              maxLength={200}
              className="mt-1 w-full rounded-md bg-transparent py-1 text-[19px] font-semibold outline-none focus:bg-[#f2f0e9]"
            />
            {generated.source?.kind === 'youtube' && <p className="break-all text-xs text-[#5c6b67]">Fonte video: {generated.source.url}</p>}
            {generated.source?.kind === 'document' && <p className="text-xs text-[#5c6b67]">Fonte documento: {generated.source.file_name}</p>}
            {generated.sections.map((section, index) => (
              <div key={index} className="mt-3">
                <label className="sr-only" htmlFor={`pdf-heading-${index}`}>Titolo sezione {index + 1}</label>
                <input
                  id={`pdf-heading-${index}`}
                  value={section.heading}
                  onChange={event => editSection(index, 'heading', event.target.value)}
                  maxLength={200}
                  className="w-full rounded-md bg-transparent py-0.5 text-[15px] font-semibold outline-none focus:bg-[#f2f0e9]"
                />
                <label className="sr-only" htmlFor={`pdf-body-${index}`}>Testo sezione {index + 1}</label>
                <textarea
                  id={`pdf-body-${index}`}
                  value={section.body}
                  onChange={event => editSection(index, 'body', event.target.value)}
                  rows={Math.min(14, Math.max(3, Math.ceil(section.body.length / 60)))}
                  className="w-full resize-y rounded-md bg-transparent py-0.5 text-sm leading-relaxed outline-none focus:bg-[#f2f0e9]"
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted">Tocca il testo per correggerlo. L’anteprima non viene archiviata finché non la salvi.</p>
          {error && <p role="alert" className="mt-3 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" onClick={download} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-accent text-[16px] font-semibold text-white transition active:scale-[0.98]">
              <Download className="h-5 w-5" strokeWidth={1.9} /> Scarica PDF
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || saved}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-line text-[15px] font-medium disabled:opacity-70"
            >
              {saving ? <Spinner className="h-5 w-5" /> : <FilePlus2 className="h-5 w-5" strokeWidth={1.9} />}
              {saved ? 'Salvato nell’archivio' : 'Salva nell’archivio privato'}
            </button>
            <button type="button" onClick={restart} className="flex min-h-11 items-center justify-center gap-2 text-sm font-medium text-accent">
              <RotateCcw className="h-4 w-4" strokeWidth={1.9} /> Ricomincia
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
