import { useRef, useState } from 'react'
import { Download, FilePlus2, Sparkles } from 'lucide-react'
import { Card, PrimaryButton, Sheet, Spinner, inputClass } from '../../components/ui'
import { invokeFunction } from '../../lib/integrations'
import { createPdfBlob, downloadPdf, pdfFileName, validateGeneratedDoc, type GeneratedDoc } from '../../lib/pdf'
import { uploadDocument } from '../../lib/documentUpload'
import type { DocumentRow } from '../../types'

type Source = 'text' | 'youtube' | 'document'
type Format = 'sintesi' | 'appunti' | 'schema'

export function GeneratePdfCard({ documents, onSaved }: { documents: DocumentRow[]; onSaved: () => Promise<void> }) {
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

  function editTitle(title: string) {
    setGenerated(current => current ? { ...current, title } : current)
    setSaved(false)
  }
  function editSection(index: number, key: 'heading' | 'body', value: string) {
    setGenerated(current => current ? { ...current, sections: current.sections.map((section, i) => i === index ? { ...section, [key]: value } : section) } : current)
    setSaved(false)
  }

  return <>
    <Card>
      <h2 className="mb-2 flex items-center gap-2 font-semibold"><FilePlus2 className="h-4 w-4 text-accent" /> Crea un documento PDF</h2>
      <p className="mb-3 text-sm text-muted">Trasforma testo, un video YouTube pubblico o un documento già caricato in una sintesi, appunti o uno schema. Controlla sempre il risultato AI.</p>
      <label className="mb-2 block text-sm font-medium" htmlFor="pdf-source">Fonte</label>
      <select id="pdf-source" value={source} onChange={event => changeSource(event.target.value as Source)} className={`${inputClass} mb-3`}>
        <option value="text">Testo e istruzioni</option><option value="youtube">Video YouTube pubblico</option><option value="document">Documento caricato</option>
      </select>
      {source === 'youtube' && <><label className="mb-2 block text-sm font-medium" htmlFor="pdf-video">Link YouTube</label><input id="pdf-video" type="url" value={videoUrl} onChange={event => changeInput(() => setVideoUrl(event.target.value))} className={`${inputClass} mb-3`} placeholder="https://www.youtube.com/watch?v=…" /></>}
      {source === 'document' && <><label className="mb-2 block text-sm font-medium" htmlFor="pdf-document">Documento dell’archivio</label><select id="pdf-document" value={documentId} onChange={event => changeInput(() => setDocumentId(event.target.value))} className={`${inputClass} mb-3`}><option value="">Seleziona un documento</option>{documents.map(doc => <option key={doc.id} value={doc.id}>{doc.file_name}</option>)}</select></>}
      <label className="mb-2 block text-sm font-medium" htmlFor="pdf-format">Formato</label>
      <select id="pdf-format" value={format} onChange={event => changeInput(() => setFormat(event.target.value as Format))} className={`${inputClass} mb-3`}><option value="sintesi">Sintesi</option><option value="appunti">Appunti</option><option value="schema">Schema</option></select>
      <label className="mb-2 block text-sm font-medium" htmlFor="pdf-prompt">{source === 'text' ? 'Testo o istruzioni' : 'Istruzioni aggiuntive (facoltative)'}</label>
      <textarea id="pdf-prompt" value={prompt} onChange={event => changeInput(() => setPrompt(event.target.value))} maxLength={2000} className={`${inputClass} mb-3 min-h-[90px] resize-y`} placeholder={source === 'text' ? 'Es. Spiega come organizzare un budget mensile…' : 'Es. Evidenzia i concetti finanziari principali'} />
      <PrimaryButton onClick={() => void generate()} disabled={generating}>
        {generating ? <><Spinner className="h-5 w-5 text-white" /> L’AI sta scrivendo…</> : <><Sparkles className="h-5 w-5" /> Genera documento</>}
      </PrimaryButton>
    </Card>
    {error && !generated && <p role="alert" className="rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}
    <Sheet open={generated !== null} onClose={() => setGenerated(null)} title="Anteprima PDF">
      {generated && <div className="space-y-4 pb-5">
        <p className="text-sm text-muted">Puoi correggere il testo prima di scaricarlo o salvarlo. L’anteprima non viene archiviata automaticamente.</p>
        {error && <p role="alert" className="rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}
        <label className="block text-sm font-medium" htmlFor="pdf-title">Titolo</label>
        <input id="pdf-title" value={generated.title} onChange={event => editTitle(event.target.value)} maxLength={200} className={inputClass} />
        {generated.source?.kind === 'youtube' && <p className="break-all text-xs text-muted">Fonte video: {generated.source.url}</p>}
        {generated.source?.kind === 'document' && <p className="text-xs text-muted">Fonte documento: {generated.source.file_name}</p>}
        {generated.sections.map((section, index) => <div key={index} className="space-y-2 rounded-xl border border-line p-3">
          <label className="block text-sm font-medium" htmlFor={`pdf-heading-${index}`}>Titolo sezione {index + 1}</label>
          <input id={`pdf-heading-${index}`} value={section.heading} onChange={event => editSection(index, 'heading', event.target.value)} maxLength={200} className={inputClass} />
          <label className="block text-sm font-medium" htmlFor={`pdf-body-${index}`}>Testo sezione {index + 1}</label>
          <textarea id={`pdf-body-${index}`} value={section.body} onChange={event => editSection(index, 'body', event.target.value)} className={`${inputClass} min-h-40 resize-y`} />
        </div>)}
        <PrimaryButton onClick={download}><Download className="h-5 w-5" /> Scarica PDF</PrimaryButton>
        <PrimaryButton onClick={() => void save()} disabled={saving || saved}>{saving ? <Spinner className="h-5 w-5 text-white" /> : <FilePlus2 className="h-5 w-5" />}{saved ? 'Salvato nell’archivio' : 'Salva nell’archivio privato'}</PrimaryButton>
      </div>}
    </Sheet>
  </>
}
