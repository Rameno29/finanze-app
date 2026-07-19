import { useEffect, useRef, useState } from 'react'
import { Camera, Check, CloudUpload, Crop, Download, RotateCw, Share2, Sparkles, Trash2 } from 'lucide-react'
import { PrimaryButton, Sheet, Spinner } from '../../components/ui'
import { requireUserId, supabase } from '../../lib/supabase'
import { todayISO } from '../../lib/format'
import {
  SCAN_FILTERS,
  buildScansPdf,
  canShareFiles,
  previewScan,
  processScan,
  type ScanFilter,
  type ScanPageImage,
  type ScanPreview,
} from '../../lib/scanner'
import { FULL_QUAD, orderQuad, type Quad } from '../../lib/docDetect'

interface ScanPage {
  id: string
  file: File
  filter: ScanFilter
  rotation: 0 | 90 | 180 | 270
  /** Bordi usati per il raddrizzamento (null = foto intera). */
  quad: Quad | null
  preview: ScanPreview | null
  image: ScanPageImage | null
  busy: boolean
}

/**
 * Scanner documenti: fotografa una o più pagine (documenti d'identità, moduli,
 * contratti…), migliora la leggibilità con i filtri e ottieni un unico PDF da
 * condividere con il foglio nativo (WhatsApp, Mail, …), scaricare o salvare
 * nei Documenti. L'elaborazione avviene tutta sul dispositivo.
 */
export function ScannerSheet({
  open,
  onClose,
  onSavedToDocuments,
}: {
  open: boolean
  onClose: () => void
  onSavedToDocuments: () => void
}) {
  const [pages, setPages] = useState<ScanPage[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [exporting, setExporting] = useState(false)
  const [savingCloud, setSavingCloud] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setPages([])
    setError('')
    setNotice('')
    setEditingId(null)
  }, [open])

  function pdfFileName(): string {
    return `scansione-${todayISO()}.pdf`
  }

  async function reprocess(
    page: ScanPage,
    patch: Partial<Pick<ScanPage, 'filter' | 'rotation' | 'quad'>>,
  ) {
    const next = { ...page, ...patch }
    setPages((prev) => prev.map((p) => (p.id === page.id ? { ...next, busy: true } : p)))
    try {
      const image = await processScan(next.file, next.filter, next.rotation, next.quad)
      setPages((prev) => prev.map((p) => (p.id === page.id ? { ...next, image, busy: false } : p)))
    } catch {
      setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, busy: false } : p)))
      setError('Elaborazione della pagina non riuscita, riprova.')
    }
  }

  async function addFiles(files: FileList) {
    setError('')
    setNotice('')
    for (const file of Array.from(files).slice(0, 20 - pages.length)) {
      if (!file.type.startsWith('image/')) continue
      const id = crypto.randomUUID()
      const page: ScanPage = {
        id, file, filter: 'migliorato', rotation: 0, quad: null, preview: null, image: null, busy: true,
      }
      setPages((prev) => [...prev, page])
      try {
        // Anteprima + riconoscimento bordi: se affidabile, ritaglia e raddrizza subito.
        const preview = await previewScan(file)
        const quad = preview.detectedQuad
        const image = await processScan(file, page.filter, page.rotation, quad)
        setPages((prev) =>
          prev.map((p) => (p.id === id ? { ...p, preview, quad, image, busy: false } : p)),
        )
      } catch {
        setPages((prev) => prev.filter((p) => p.id !== id))
        setError('Non riesco a leggere una delle foto: riprova.')
      }
    }
  }

  function readyImages(): ScanPageImage[] {
    return pages.filter((p) => p.image && !p.busy).map((p) => p.image!)
  }

  function makePdfFile(): File | null {
    const images = readyImages()
    if (images.length === 0) {
      setError('Aggiungi almeno una pagina.')
      return null
    }
    const blob = buildScansPdf(images).output('blob')
    return new File([blob], pdfFileName(), { type: 'application/pdf' })
  }

  /** Condivisione col foglio nativo; se non disponibile, scarica il PDF. */
  async function sharePdf() {
    setExporting(true)
    setError('')
    setNotice('')
    try {
      const file = makePdfFile()
      if (!file) return
      if (canShareFiles(file)) {
        try {
          await navigator.share({ files: [file], title: 'Scansione AJE' })
          setNotice('PDF condiviso!')
        } catch (cause) {
          // L'utente ha chiuso il foglio di condivisione: nessun errore da mostrare.
          if ((cause as { name?: string } | null)?.name !== 'AbortError') {
            downloadPdfFile(file)
            setNotice('Condivisione non disponibile: PDF scaricato.')
          }
        }
      } else {
        downloadPdfFile(file)
        setNotice('Questo browser non ha il foglio di condivisione: PDF scaricato.')
      }
    } finally {
      setExporting(false)
    }
  }

  function downloadPdfFile(file: File) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.hidden = true
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function handleDownload() {
    setError('')
    setNotice('')
    const file = makePdfFile()
    if (!file) return
    downloadPdfFile(file)
    setNotice('PDF scaricato.')
  }

  /** Salva il PDF nell'archivio Documenti (senza avviare l'analisi AI). */
  async function saveToDocuments() {
    if (!navigator.onLine) {
      setError('Per salvare nei Documenti serve la connessione a internet.')
      return
    }
    setSavingCloud(true)
    setError('')
    setNotice('')
    try {
      const file = makePdfFile()
      if (!file) return
      const userId = await requireUserId()
      const path = `${userId}/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
      if (uploadError) throw uploadError
      const { error: insertError } = await supabase
        .from('documents')
        .insert({ user_id: userId, doc_type: 'altro', storage_path: path, file_name: file.name })
      if (insertError) {
        await supabase.storage.from('documents').remove([path])
        throw insertError
      }
      setNotice('Salvato nei Documenti. L’analisi AI parte solo se la avvii tu con "Analizza".')
      onSavedToDocuments()
    } catch {
      setError('Salvataggio non riuscito, riprova.')
    } finally {
      setSavingCloud(false)
    }
  }

  const ready = pages.length > 0 && pages.every((p) => !p.busy) && readyImages().length > 0
  const editingPage = editingId ? pages.find((p) => p.id === editingId) : undefined

  if (editingPage?.preview) {
    return (
      <Sheet open={open} onClose={() => setEditingId(null)} title="Regola i bordi">
        <CornerEditor
          preview={editingPage.preview}
          quad={editingPage.quad}
          onCancel={() => setEditingId(null)}
          onApply={(quad) => {
            setEditingId(null)
            void reprocess(editingPage, { quad })
          }}
        />
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Scanner documenti">
      <div className="pb-4">
        <p className="mb-3 text-sm text-muted">
          Fotografa carta d'identità, moduli o contratti (anche più pagine), migliora la
          leggibilità con i filtri e ottieni un unico PDF da condividere. Le foto restano sul tuo
          dispositivo finché non decidi tu.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files)
            e.target.value = ''
          }}
        />

        {pages.length === 0 ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex min-h-[140px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent/50 bg-accent-soft text-accent"
          >
            <Camera className="h-8 w-8" />
            <span className="font-semibold">Scatta la prima pagina</span>
            <span className="text-xs text-accent/70">oppure scegli foto dalla galleria</span>
          </button>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {pages.map((page, index) => (
                <div key={page.id} className="rounded-2xl border border-line p-3">
                  <div className="flex gap-3">
                    <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-card-2">
                      {page.busy || !page.image ? (
                        <Spinner className="h-5 w-5" />
                      ) : (
                        <img
                          src={page.image.dataUrl}
                          alt={`Pagina ${index + 1}`}
                          className="h-full w-full object-contain"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="min-w-0 text-sm font-semibold">
                          Pagina {index + 1}
                          <span className="ml-1.5 align-middle text-[10px] font-medium text-muted">
                            {page.quad ? '· ritagliata' : '· foto intera'}
                          </span>
                        </span>
                        <span className="flex gap-1">
                          <button
                            onClick={() => setEditingId(page.id)}
                            disabled={page.busy || !page.preview}
                            aria-label={`Regola i bordi della pagina ${index + 1}`}
                            title="Regola i bordi"
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-card-2 text-accent disabled:opacity-50"
                          >
                            <Crop className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              void reprocess(page, {
                                rotation: (((page.rotation + 90) % 360) as 0 | 90 | 180 | 270),
                              })
                            }
                            disabled={page.busy}
                            aria-label={`Ruota pagina ${index + 1}`}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-card-2 text-muted disabled:opacity-50"
                          >
                            <RotateCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setPages((prev) => prev.filter((p) => p.id !== page.id))}
                            aria-label={`Elimina pagina ${index + 1}`}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-card-2 text-expense"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {SCAN_FILTERS.map(([value, label]) => (
                          <button
                            key={value}
                            onClick={() => void reprocess(page, { filter: value })}
                            disabled={page.busy}
                            className={`min-h-[34px] rounded-lg text-[12px] font-semibold transition disabled:opacity-50 ${
                              page.filter === value
                                ? 'bg-accent text-white'
                                : 'bg-card-2 text-muted'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => fileRef.current?.click()}
              disabled={pages.length >= 20}
              className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-sm font-semibold text-accent disabled:opacity-50"
            >
              <Camera className="h-4 w-4" /> Aggiungi pagina ({pages.length}/20)
            </button>

            <PrimaryButton onClick={() => void sharePdf()} disabled={!ready || exporting} className="mt-4">
              {exporting ? (
                <Spinner className="h-5 w-5 text-white" />
              ) : (
                <>
                  <Share2 className="h-5 w-5" /> Condividi PDF ({readyImages().length} pagine)
                </>
              )}
            </PrimaryButton>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                onClick={handleDownload}
                disabled={!ready}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Scarica
              </button>
              <button
                onClick={() => void saveToDocuments()}
                disabled={!ready || savingCloud}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-accent disabled:opacity-50"
              >
                {savingCloud ? <Spinner className="h-4 w-4" /> : <CloudUpload className="h-4 w-4" />}
                Nei Documenti
              </button>
            </div>
          </>
        )}

        {notice && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-income/10 px-4 py-3 text-sm text-income">
            <Check className="h-4 w-4 shrink-0" /> {notice}
          </p>
        )}
        {error && <p className="mt-3 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}
      </div>
    </Sheet>
  )
}

/** Dimensioni e zoom della lente d'ingrandimento sul trascinamento degli angoli. */
const LOUPE_SIZE = 120
const LOUPE_ZOOM = 2.5

/**
 * Editor dei bordi: mostra la foto originale con i 4 angoli trascinabili
 * (con lente d'ingrandimento per la precisione); il quadrilatero scelto
 * viene raddrizzato in una pagina piatta. Il bottone AI chiede a Gemini
 * di individuare gli angoli del documento.
 */
function CornerEditor({
  preview,
  quad,
  onCancel,
  onApply,
}: {
  preview: ScanPreview
  quad: Quad | null
  onCancel: () => void
  onApply: (quad: Quad | null) => void
}) {
  const [points, setPoints] = useState<Quad>(quad ?? preview.detectedQuad ?? FULL_QUAD)
  const [dragging, setDragging] = useState<number | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  function moveTo(clientX: number, clientY: number) {
    const box = containerRef.current?.getBoundingClientRect()
    if (dragging === null || !box) return
    const x = Math.min(1, Math.max(0, (clientX - box.left) / box.width))
    const y = Math.min(1, Math.max(0, (clientY - box.top) / box.height))
    setPoints((prev) => prev.map((p, i) => (i === dragging ? { x, y } : p)) as Quad)
  }

  /** L'AI (Gemini) individua i 4 angoli: utile quando il rilevamento locale sbaglia. */
  async function detectWithAi() {
    if (!navigator.onLine) {
      setAiError('Per i bordi con AI serve la connessione a internet.')
      return
    }
    setAiBusy(true)
    setAiError('')
    try {
      const base64 = preview.dataUrl.split(',')[1] ?? ''
      const { data, error } = await supabase.functions.invoke('ai-analyze', {
        body: { mode: 'detect_corners', image_base64: base64, image_mime: 'image/jpeg' },
      })
      if (error) throw error
      const corners = (data as { corners: Quad | null }).corners
      if (!corners) {
        setAiError('L’AI non ha riconosciuto un documento in questa foto.')
        return
      }
      setPoints(orderQuad([...corners]))
    } catch {
      setAiError('Rilevamento AI non riuscito, riprova tra poco.')
    } finally {
      setAiBusy(false)
    }
  }

  const loupePoint = dragging !== null ? points[dragging] : null
  const containerBox = containerRef.current?.getBoundingClientRect()

  return (
    <div className="pb-4">
      <p className="mb-3 text-sm text-muted">
        Trascina gli angoli sui bordi del documento: tenendo premuto compare una lente
        d'ingrandimento per la massima precisione.
      </p>

      <div
        ref={containerRef}
        className="relative touch-none select-none overflow-hidden rounded-2xl border border-line"
        onPointerMove={(e) => moveTo(e.clientX, e.clientY)}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
      >
        <img src={preview.dataUrl} alt="Foto originale" className="block w-full" draggable={false} />
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polygon
            points={points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
            fill="rgba(45,212,167,0.18)"
            stroke="#2dd4a7"
            strokeWidth="0.7"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {points.map((p, i) => (
          <button
            key={i}
            aria-label={`Angolo ${i + 1}`}
            onPointerDown={(e) => {
              setDragging(i)
              ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
            }}
            className={`absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-lg transition-opacity ${
              dragging === i ? 'bg-accent/70 opacity-60' : 'bg-accent'
            }`}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          />
        ))}

        {/* Lente d'ingrandimento: zona sotto il dito ingrandita, con mirino */}
        {loupePoint && containerBox && (
          <div
            className="pointer-events-none absolute z-10 rounded-full border-4 border-white bg-card shadow-2xl"
            style={{
              width: LOUPE_SIZE,
              height: LOUPE_SIZE,
              left: `${Math.min(0.86, Math.max(0.14, loupePoint.x)) * 100}%`,
              top: `${loupePoint.y * 100}%`,
              transform: `translate(-50%, ${loupePoint.y < 0.3 ? '35%' : '-135%'})`,
              backgroundImage: `url(${preview.dataUrl})`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: `${containerBox.width * LOUPE_ZOOM}px ${containerBox.height * LOUPE_ZOOM}px`,
              backgroundPosition: `${-(loupePoint.x * containerBox.width * LOUPE_ZOOM - LOUPE_SIZE / 2)}px ${-(loupePoint.y * containerBox.height * LOUPE_ZOOM - LOUPE_SIZE / 2)}px`,
            }}
          >
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-accent/70" />
            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-accent/70" />
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent" />
          </div>
        )}
      </div>

      <button
        onClick={() => void detectWithAi()}
        disabled={aiBusy}
        className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent-soft text-sm font-semibold text-accent disabled:opacity-60"
      >
        {aiBusy ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        Trova i bordi con l'AI
      </button>
      <p className="mt-1.5 text-center text-[11px] text-muted">
        Questo bottone invia la foto alla funzione AI sicura di AJE solo per trovare i bordi.
      </p>
      {aiError && <p className="mt-2 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{aiError}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {preview.detectedQuad && (
          <button
            onClick={() => setPoints(preview.detectedQuad!)}
            className="flex min-h-[42px] items-center justify-center rounded-xl border border-line text-sm font-semibold"
          >
            Bordi automatici
          </button>
        )}
        <button
          onClick={() => setPoints(FULL_QUAD)}
          className="flex min-h-[42px] items-center justify-center rounded-xl border border-line text-sm font-semibold"
        >
          Foto intera
        </button>
      </div>

      <PrimaryButton
        onClick={() => {
          const ordered = orderQuad([...points])
          const isFull = ordered.every(
            (p, i) => Math.abs(p.x - FULL_QUAD[i].x) < 0.01 && Math.abs(p.y - FULL_QUAD[i].y) < 0.01,
          )
          onApply(isFull ? null : ordered)
        }}
        className="mt-3"
      >
        Applica ritaglio
      </PrimaryButton>
      <button
        onClick={onCancel}
        className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl font-semibold text-muted"
      >
        Annulla
      </button>
    </div>
  )
}
