import { jsPDF } from 'jspdf'

export interface GeneratedDoc {
  title: string
  sections: Array<{ heading: string; body: string }>
}

const MARGIN = 20
const PAGE_W = 210
const PAGE_H = 297
const MAX_W = PAGE_W - MARGIN * 2

/** Genera e scarica un PDF A4 dal documento creato dall'AI. */
export function downloadPdf(docData: GeneratedDoc): void {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      pdf.addPage()
      y = MARGIN
    }
  }

  // Titolo
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  const titleLines = pdf.splitTextToSize(docData.title, MAX_W)
  pdf.text(titleLines, MARGIN, y + 6)
  y += 6 + titleLines.length * 8 + 4

  pdf.setDrawColor(99, 102, 241)
  pdf.setLineWidth(0.8)
  pdf.line(MARGIN, y, MARGIN + 40, y)
  y += 8

  for (const section of docData.sections) {
    // Titolo sezione
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    const headingLines = pdf.splitTextToSize(section.heading, MAX_W)
    ensureSpace(headingLines.length * 6 + 14)
    pdf.text(headingLines, MARGIN, y)
    y += headingLines.length * 6 + 2

    // Corpo: paragrafi e elenchi puntati
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    for (const rawLine of section.body.split('\n')) {
      const line = rawLine.trim()
      if (!line) {
        y += 2.5
        continue
      }
      const isBullet = line.startsWith('- ') || line.startsWith('* ')
      const text = isBullet ? line.slice(2) : line
      const indent = isBullet ? 5 : 0
      const wrapped = pdf.splitTextToSize(text, MAX_W - indent)
      ensureSpace(wrapped.length * 5.5)
      if (isBullet) pdf.circle(MARGIN + 1.2, y - 1.4, 0.7, 'F')
      pdf.text(wrapped, MARGIN + indent, y)
      y += wrapped.length * 5.5 + 1
    }
    y += 5
  }

  // Piè di pagina con numero pagina
  const pages = pdf.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(150)
    pdf.text(`Generato con AJE · pagina ${i} di ${pages}`, PAGE_W / 2, PAGE_H - 8, { align: 'center' })
    pdf.setTextColor(0)
  }

  const safeName = docData.title.toLowerCase().replace(/[^a-z0-9àèéìòù]+/gi, '-').slice(0, 50)
  pdf.save(`${safeName || 'documento'}.pdf`)
}
