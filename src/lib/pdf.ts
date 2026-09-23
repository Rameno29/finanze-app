import { jsPDF } from 'jspdf'

export type PdfSource = { kind: 'text' } | { kind: 'youtube'; url: string } | { kind: 'document'; file_name: string }
export interface GeneratedDoc {
  title: string
  sections: Array<{ heading: string; body: string }>
  source?: PdfSource
}

const MARGIN = 20
const PAGE_W = 210
const PAGE_H = 297
const MAX_W = PAGE_W - MARGIN * 2

export function validateGeneratedDoc(value: unknown): GeneratedDoc {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Il documento generato non è valido.')
  const doc = value as Record<string, unknown>
  if (typeof doc.title !== 'string' || !doc.title.trim() || doc.title.length > 200 || !Array.isArray(doc.sections) || doc.sections.length < 1 || doc.sections.length > 24) throw new Error('Il documento generato è incompleto.')
  const sections = doc.sections.map((section: unknown) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) throw new Error('Il documento generato è incompleto.')
    const item = section as Record<string, unknown>
    if (typeof item.heading !== 'string' || !item.heading.trim() || item.heading.length > 200 || typeof item.body !== 'string' || !item.body.trim() || item.body.length > 20000) throw new Error('Completa tutti i titoli e i testi prima di creare il PDF.')
    return { heading: item.heading.trim(), body: item.body.trim() }
  })
  if (sections.reduce((length, section) => length + section.body.length, 0) > 50000) throw new Error('Il documento è troppo lungo.')
  const source = doc.source
  if (source !== undefined && (!source || typeof source !== 'object' || !['text', 'youtube', 'document'].includes((source as PdfSource).kind))) throw new Error('Fonte del documento non valida.')
  return { title: doc.title.trim(), sections, source: source as PdfSource | undefined }
}

export function pdfFileName(doc: GeneratedDoc): string {
  const name = doc.title.toLowerCase().replace(/[^a-z0-9àèéìòù]+/gi, '-').slice(0, 50).replace(/-+$/, '')
  return `${name || 'documento'}.pdf`
}

function buildPdf(input: GeneratedDoc): jsPDF {
  const doc = validateGeneratedDoc(input)
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN
  const ensureSpace = (height: number) => {
    if (y + height > PAGE_H - MARGIN) { pdf.addPage(); y = MARGIN }
  }
  const writeLines = (value: string, width: number, x: number, height: number) => {
    for (const line of pdf.splitTextToSize(value, width) as string[]) {
      ensureSpace(height)
      pdf.text(line, x, y)
      y += height
    }
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  writeLines(doc.title, MAX_W, MARGIN, 8)
  y += 2
  pdf.setDrawColor(99, 102, 241)
  pdf.setLineWidth(0.8)
  pdf.line(MARGIN, y, MARGIN + 40, y)
  y += 8

  if (doc.source && doc.source.kind !== 'text') {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    const label = doc.source.kind === 'youtube' ? `Fonte video: ${doc.source.url}` : `Fonte documento: ${doc.source.file_name}`
    writeLines(label, MAX_W, MARGIN, 4.5)
    y += 5
  }

  for (const section of doc.sections) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    ensureSpace(14)
    writeLines(section.heading, MAX_W, MARGIN, 6)
    y += 3
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    for (const rawLine of section.body.split('\n')) {
      const line = rawLine.trim()
      if (!line) { y += 2.5; continue }
      const bullet = line.startsWith('- ') || line.startsWith('* ')
      const x = MARGIN + (bullet ? 5 : 0)
      const wrapped = pdf.splitTextToSize(bullet ? line.slice(2) : line, MAX_W - (bullet ? 5 : 0)) as string[]
      wrapped.forEach((part, index) => {
        ensureSpace(5.5)
        if (bullet && index === 0) pdf.circle(MARGIN + 1.2, y - 1.4, 0.7, 'F')
        pdf.text(part, x, y)
        y += 5.5
      })
      y += 1
    }
    y += 5
  }

  const pages = pdf.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(150)
    pdf.text(`Generato con AJE · pagina ${i} di ${pages}`, PAGE_W / 2, PAGE_H - 8, { align: 'center' })
    pdf.setTextColor(0)
  }
  return pdf
}

export function createPdfBlob(doc: GeneratedDoc): Blob {
  return buildPdf(doc).output('blob')
}

/** Il download e il salvataggio privato condividono lo stesso renderer. */
export function downloadPdf(doc: GeneratedDoc): void {
  buildPdf(doc).save(pdfFileName(doc))
}
