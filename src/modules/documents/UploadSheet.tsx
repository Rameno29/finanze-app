import type { ComponentType } from 'react'
import { Camera, Check, FileText, Receipt, ReceiptText, TriangleAlert, Upload } from 'lucide-react'
import { Sheet } from '../../components/ui'
import type { DocumentRow } from '../../types'

export type DocType = DocumentRow['doc_type']

export type UploadPhase =
  | { kind: 'idle' }
  | { kind: 'upload' }
  | { kind: 'analyze' }
  | { kind: 'done'; title: string; summary: string; action?: { label: string; run: () => void } }
  | { kind: 'unreadable'; fileName: string; previewUrl: string | null; detail: string; onManual?: () => void }

const READING_TIPS = [
  'Appoggia il foglio su un piano scuro, con buona luce.',
  'Inquadra tutto il documento, senza ombre né riflessi.',
  'Tieni il telefono dritto e fermo, o carica il PDF originale.',
]

const UPLOAD_TYPES: Array<{ type: DocType; label: string; hint: string; icon: ComponentType<{ className?: string; strokeWidth?: number }> }> = [
  { type: 'busta_paga', label: 'Busta paga', hint: 'PDF o foto', icon: ReceiptText },
  { type: 'scontrino', label: 'Scontrino', hint: 'Scatta o carica', icon: Receipt },
  { type: 'altro', label: 'Documento', hint: 'Spiegazione AI', icon: FileText },
]

/** Foglio "Carica documento": tipo, fotocamera o file, avanzamento e risultato. */
export function UploadSheet({
  open,
  onClose,
  type,
  onTypeChange,
  phase,
  progress,
  error,
  isDesktop,
  droppedFile,
  onPickCamera,
  onPickFile,
  onUploadDropped,
}: {
  open: boolean
  onClose: () => void
  type: DocType
  onTypeChange: (type: DocType) => void
  phase: UploadPhase
  progress: number
  error: string
  isDesktop: boolean
  droppedFile: File | null
  onPickCamera: () => void
  onPickFile: () => void
  onUploadDropped: () => void
}) {
  const busy = phase.kind === 'upload' || phase.kind === 'analyze'

  let footer = null
  if (phase.kind === 'unreadable') {
    footer = (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={isDesktop ? onPickFile : onPickCamera}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-accent text-[16px] font-semibold text-white transition active:scale-[0.98]"
        >
          {isDesktop ? <Upload className="h-5 w-5" strokeWidth={1.9} /> : <Camera className="h-5 w-5" strokeWidth={1.9} />}
          {isDesktop ? 'Scegli un altro file' : 'Scatta di nuovo'}
        </button>
        {phase.onManual && (
          <button type="button" onClick={phase.onManual} className="flex min-h-12 w-full items-center justify-center text-[15px] font-semibold text-accent">
            Inserisci i dati a mano
          </button>
        )}
      </div>
    )
  } else if (phase.kind === 'done') {
    footer = (
      <button
        type="button"
        onClick={phase.action?.run ?? onClose}
        className="flex min-h-14 w-full items-center justify-center rounded-[18px] bg-accent text-[16px] font-semibold text-white transition active:scale-[0.98]"
      >
        {phase.action?.label ?? 'Fatto'}
      </button>
    )
  } else if (!busy) {
    footer = droppedFile ? (
      <button
        type="button"
        onClick={onUploadDropped}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-accent px-4 text-[16px] font-semibold text-white transition active:scale-[0.98]"
      >
        <Upload className="h-5 w-5 shrink-0" strokeWidth={1.9} /> <span className="truncate">Carica «{droppedFile.name}»</span>
      </button>
    ) : isDesktop ? (
      <button
        type="button"
        onClick={onPickFile}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-accent text-[16px] font-semibold text-white transition active:scale-[0.98]"
      >
        <Upload className="h-5 w-5" strokeWidth={1.9} /> Scegli un file dal computer
      </button>
    ) : (
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPickCamera}
          className="flex min-h-14 items-center justify-center gap-2 rounded-[18px] bg-accent text-[16px] font-semibold text-white transition active:scale-[0.98]"
        >
          <Camera className="h-5 w-5" strokeWidth={1.9} /> Scatta foto
        </button>
        <button
          type="button"
          onClick={onPickFile}
          className="flex min-h-14 items-center justify-center gap-2 rounded-[18px] border border-line text-[16px] font-semibold transition active:scale-[0.98]"
        >
          <Upload className="h-5 w-5" strokeWidth={1.9} /> Scegli file
        </button>
      </div>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Carica documento" footer={footer}>
      {phase.kind === 'unreadable' ? (
        <div className="py-2">
          <div className="flex items-center gap-3.5">
            {phase.previewUrl ? (
              <img src={phase.previewUrl} alt="" className="h-20 w-16 shrink-0 rounded-md object-cover shadow-[var(--shadow-paper)]" />
            ) : (
              <span className="flex h-20 w-16 shrink-0 items-center justify-center rounded-md bg-card-2 text-muted">
                <FileText className="h-7 w-7" strokeWidth={1.9} />
              </span>
            )}
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xl font-semibold">
                <TriangleAlert className="h-5 w-5 shrink-0 text-expense" strokeWidth={1.9} aria-hidden="true" /> Non riesco a leggere il documento
              </p>
              <p className="mt-1 truncate text-[13px] text-muted">{phase.fileName} è nell’archivio.</p>
            </div>
          </div>
          <ul className="mt-5 space-y-2 text-sm leading-[1.5]">
            {READING_TIPS.map((tip) => (
              <li key={tip} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.4} aria-hidden="true" /> {tip}</li>
            ))}
          </ul>
          {phase.detail && <p className="mt-4 text-[13px] text-muted">Dettaglio: {phase.detail}</p>}
        </div>
      ) : phase.kind === 'done' ? (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="upload-done flex h-[52px] w-[52px] items-center justify-center rounded-full bg-brand-soft text-brand">
            <Check className="h-7 w-7" strokeWidth={2.4} />
          </span>
          <p className="mt-4 text-xl font-semibold">{phase.title}</p>
          <p className="mt-1.5 max-w-[320px] text-sm leading-[1.55] text-muted">{phase.summary}</p>
        </div>
      ) : busy ? (
        <div className="py-8" role="status" aria-live="polite">
          <p className="tabular text-[44px] font-semibold leading-none tracking-[-0.03em]">{progress}%</p>
          <p className="mt-2 text-sm text-muted">{phase.kind === 'upload' ? 'Carico il file cifrato…' : 'Leggo il documento…'}</p>
          <span className="mt-4 block h-1.5 overflow-hidden rounded-full bg-card-2">
            <span className="block h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </span>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {UPLOAD_TYPES.map(({ type: value, label, hint, icon: Icon }) => {
              const selected = type === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onTypeChange(value)}
                  className={`flex min-h-[68px] items-center gap-3.5 rounded-[14px] border-[1.5px] px-4 text-left transition-colors duration-[250ms] ${
                    selected ? 'border-ink bg-card-2' : 'border-line'
                  }`}
                >
                  <Icon className="h-6 w-6 shrink-0 text-brand" strokeWidth={1.9} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">{label}</span>
                    <span className="block text-[13px] text-muted">{hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {droppedFile && <p className="mt-3 truncate text-sm">File pronto: <strong>{droppedFile.name}</strong></p>}
          <p className="mt-4 text-[13px] leading-[1.55] text-muted">
            La lettura automatica usa la tua chiave Gemini; senza chiave il file viene solo archiviato.
          </p>
        </>
      )}
      {error && <p role="alert" className="mt-3 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}
    </Sheet>
  )
}
