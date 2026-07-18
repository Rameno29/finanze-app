import { jsPDF } from 'jspdf'

/**
 * Scanner documenti: elaborazione immagini lato client (nessun upload),
 * filtri di leggibilità, rotazione e composizione del PDF multi-pagina.
 */

export type ScanFilter = 'originale' | 'migliorato' | 'grigio' | 'bn'

export const SCAN_FILTERS: Array<[ScanFilter, string]> = [
  ['migliorato', 'Migliorato'],
  ['originale', 'Originale'],
  ['grigio', 'Grigio'],
  ['bn', 'B/N'],
]

/** Lato massimo della pagina elaborata: qualità da documento senza PDF enormi. */
const MAX_SIDE = 2200
const JPEG_QUALITY = 0.85

/** Luminanza percettiva (0-255) di un pixel RGB. */
export function luminance(r: number, g: number, b: number): number {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b)
}

/**
 * Soglia di Otsu su un istogramma di luminanza a 256 livelli: separa
 * automaticamente inchiostro e carta per il filtro bianco/nero.
 */
export function otsuThreshold(histogram: number[], totalPixels: number): number {
  if (totalPixels <= 0) return 128
  let sumAll = 0
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i]
  let sumBackground = 0
  let weightBackground = 0
  let best = 128
  let bestVariance = -1
  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t]
    if (weightBackground === 0) continue
    const weightForeground = totalPixels - weightBackground
    if (weightForeground === 0) break
    sumBackground += t * histogram[t]
    const meanBackground = sumBackground / weightBackground
    const meanForeground = (sumAll - sumBackground) / weightForeground
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2
    if (variance > bestVariance) {
      bestVariance = variance
      best = t
    }
  }
  return best
}

/**
 * Estremi di luminanza al 2°/98° percentile: usati dal filtro "migliorato"
 * per stirare il contrasto ignorando pochi pixel estremi (ombre/riflessi).
 */
export function percentileBounds(
  histogram: number[],
  totalPixels: number,
  lowPct = 0.02,
  highPct = 0.98,
): { low: number; high: number } {
  if (totalPixels <= 0) return { low: 0, high: 255 }
  const lowTarget = totalPixels * lowPct
  const highTarget = totalPixels * highPct
  let cumulative = 0
  let low = 0
  let high = 255
  let lowFound = false
  for (let i = 0; i < 256; i++) {
    cumulative += histogram[i]
    if (!lowFound && cumulative >= lowTarget) {
      low = i
      lowFound = true
    }
    if (cumulative >= highTarget) {
      high = i
      break
    }
  }
  if (high <= low) return { low: 0, high: 255 }
  return { low, high }
}

/** Istogramma di luminanza di un buffer RGBA. */
export function luminanceHistogram(data: Uint8ClampedArray): number[] {
  const histogram = new Array<number>(256).fill(0)
  for (let i = 0; i < data.length; i += 4) {
    histogram[luminance(data[i], data[i + 1], data[i + 2])]++
  }
  return histogram
}

/** Applica il filtro scelto direttamente sul buffer RGBA (in place). */
export function applyFilter(data: Uint8ClampedArray, filter: ScanFilter): void {
  if (filter === 'originale') return
  const totalPixels = data.length / 4

  if (filter === 'grigio') {
    for (let i = 0; i < data.length; i += 4) {
      const l = luminance(data[i], data[i + 1], data[i + 2])
      data[i] = data[i + 1] = data[i + 2] = l
    }
    return
  }

  if (filter === 'bn') {
    const threshold = otsuThreshold(luminanceHistogram(data), totalPixels)
    for (let i = 0; i < data.length; i += 4) {
      const value = luminance(data[i], data[i + 1], data[i + 2]) > threshold ? 255 : 0
      data[i] = data[i + 1] = data[i + 2] = value
    }
    return
  }

  // "migliorato": stretch del contrasto sui percentili + leggera pulizia dello sfondo
  const { low, high } = percentileBounds(luminanceHistogram(data), totalPixels)
  const scale = 255 / (high - low)
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const stretched = (data[i + c] - low) * scale
      data[i + c] = stretched < 0 ? 0 : stretched > 255 ? 255 : stretched
    }
  }
}

export interface ScanPageImage {
  dataUrl: string
  width: number
  height: number
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Ripiego per browser senza createImageBitmap: <img> applica da solo l'EXIF.
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Immagine non leggibile'))
      }
      img.src = url
    })
  }
}

/** Elabora una foto: ridimensiona, ruota (0/90/180/270) e applica il filtro. */
export async function processScan(
  file: File,
  filter: ScanFilter,
  rotation: 0 | 90 | 180 | 270,
): Promise<ScanPageImage> {
  const source = await decodeImage(file)
  const srcW = source.width
  const srcH = source.height
  const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH))
  const drawW = Math.round(srcW * scale)
  const drawH = Math.round(srcH * scale)
  const rotated = rotation === 90 || rotation === 270
  const canvas = document.createElement('canvas')
  canvas.width = rotated ? drawH : drawW
  canvas.height = rotated ? drawW : drawH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas non disponibile')
  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(source, -drawW / 2, -drawH / 2, drawW, drawH)
  ctx.restore()
  if ('close' in source) source.close()

  if (filter !== 'originale') {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    applyFilter(imageData.data, filter)
    ctx.putImageData(imageData, 0, 0)
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY),
    width: canvas.width,
    height: canvas.height,
  }
}

const PAGE_W = 210
const PAGE_H = 297
const PDF_MARGIN = 8

/** Posiziona un'immagine dentro l'A4 (margini inclusi) mantenendo le proporzioni. */
export function fitOnA4(width: number, height: number): { x: number; y: number; w: number; h: number } {
  const maxW = PAGE_W - PDF_MARGIN * 2
  const maxH = PAGE_H - PDF_MARGIN * 2
  const scale = Math.min(maxW / width, maxH / height)
  const w = width * scale
  const h = height * scale
  return { x: (PAGE_W - w) / 2, y: (PAGE_H - h) / 2, w, h }
}

/** Compone il PDF con una scansione per pagina. */
export function buildScansPdf(pages: ScanPageImage[]): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  pages.forEach((page, index) => {
    if (index > 0) pdf.addPage()
    const { x, y, w, h } = fitOnA4(page.width, page.height)
    pdf.addImage(page.dataUrl, 'JPEG', x, y, w, h)
  })
  return pdf
}

/** Il dispositivo può condividere file via foglio nativo (WhatsApp, Mail, …)? */
export function canShareFiles(probe: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] })
}
