import { luminance, otsuThreshold } from './scanner'

/**
 * "Vero scanner": riconoscimento automatico dei bordi del documento nella foto
 * e raddrizzamento prospettico (il foglio storto diventa una pagina piatta),
 * come nelle app di scansione. Tutta matematica lato client, niente librerie.
 */

export interface Point {
  x: number
  y: number
}

/** Quadrilatero del documento in coordinate normalizzate 0..1: TL, TR, BR, BL. */
export type Quad = [Point, Point, Point, Point]

export const FULL_QUAD: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

/**
 * Ordina 4 punti come TL, TR, BR, BL: ordinamento angolare attorno al
 * centroide (robusto anche a 45°, dove le diagonali producono pareggi),
 * partendo dal punto più in alto a sinistra.
 */
export function orderQuad(points: Point[]): Quad {
  const cx = (points[0].x + points[1].x + points[2].x + points[3].x) / 4
  const cy = (points[0].y + points[1].y + points[2].y + points[3].y) / 4
  const sorted = [...points].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  )
  let start = 0
  for (let i = 1; i < 4; i++) {
    if (sorted[i].x + sorted[i].y < sorted[start].x + sorted[start].y) start = i
  }
  return [sorted[start], sorted[(start + 1) % 4], sorted[(start + 2) % 4], sorted[(start + 3) % 4]]
}

/** Area (shoelace) di un quadrilatero. */
export function quadArea(quad: Quad): number {
  let area = 0
  for (let i = 0; i < 4; i++) {
    const a = quad[i]
    const b = quad[(i + 1) % 4]
    area += a.x * b.y - b.x * a.y
  }
  return Math.abs(area) / 2
}

/**
 * Omografia che mappa il rettangolo di uscita (0,0)-(w,h) sul quadrilatero
 * sorgente: risolve il sistema lineare 8x8 della trasformazione prospettica.
 * Restituisce [a,b,c,d,e,f,g,h] con:
 *   x = (a·u + b·v + c) / (g·u + h·v + 1)
 *   y = (d·u + e·v + f) / (g·u + h·v + 1)
 */
export function homographyToQuad(outW: number, outH: number, quadPx: Quad): number[] {
  const dst: Point[] = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ]
  // Matrice aumentata 8x9
  const m: number[][] = []
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = dst[i]
    const { x, y } = quadPx[i]
    m.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x])
    m.push([0, 0, 0, u, v, 1, -u * y, -v * y, y])
  }
  // Eliminazione di Gauss con pivot parziale
  for (let col = 0; col < 8; col++) {
    let pivot = col
    for (let row = col + 1; row < 8; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    }
    if (Math.abs(m[pivot][col]) < 1e-10) throw new Error('Quadrilatero degenere')
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    for (let row = 0; row < 8; row++) {
      if (row === col) continue
      const factor = m[row][col] / m[col][col]
      for (let k = col; k < 9; k++) m[row][k] -= factor * m[col][k]
    }
  }
  return m.map((row, i) => row[8] / m[i][i])
}

/** Dimensioni di uscita del raddrizzamento: dai lati del quadrilatero. */
export function quadOutputSize(quadPx: Quad, maxSide: number): { w: number; h: number } {
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  const w = Math.max(dist(quadPx[0], quadPx[1]), dist(quadPx[3], quadPx[2]))
  const h = Math.max(dist(quadPx[0], quadPx[3]), dist(quadPx[1], quadPx[2]))
  const scale = Math.min(1, maxSide / Math.max(w, h))
  return { w: Math.max(8, Math.round(w * scale)), h: Math.max(8, Math.round(h * scale)) }
}

/**
 * Raddrizzamento prospettico con campionamento bilineare: proietta il
 * quadrilatero sorgente su un rettangolo piatto di outW×outH pixel.
 */
export function warpPerspective(
  src: ImageData,
  quadPx: Quad,
  outW: number,
  outH: number,
): ImageData {
  const [a, b, c, d, e, f, g, h] = homographyToQuad(outW, outH, quadPx)
  const out = new ImageData(outW, outH)
  const srcData = src.data
  const outData = out.data
  const srcW = src.width
  const srcH = src.height
  let index = 0
  for (let v = 0; v < outH; v++) {
    for (let u = 0; u < outW; u++) {
      const denominator = g * u + h * v + 1
      const x = (a * u + b * v + c) / denominator
      const y = (d * u + e * v + f) / denominator
      if (x >= 0 && y >= 0 && x < srcW - 1 && y < srcH - 1) {
        const x0 = Math.floor(x)
        const y0 = Math.floor(y)
        const fx = x - x0
        const fy = y - y0
        const p00 = (y0 * srcW + x0) * 4
        const p10 = p00 + 4
        const p01 = p00 + srcW * 4
        const p11 = p01 + 4
        for (let ch = 0; ch < 3; ch++) {
          const top = srcData[p00 + ch] * (1 - fx) + srcData[p10 + ch] * fx
          const bottom = srcData[p01 + ch] * (1 - fx) + srcData[p11 + ch] * fx
          outData[index + ch] = top * (1 - fy) + bottom * fy
        }
      } else {
        outData[index] = outData[index + 1] = outData[index + 2] = 255
      }
      outData[index + 3] = 255
      index += 4
    }
  }
  return out
}

/** Riduce un'ImageData a un array di luminanza. */
export function toGray(image: ImageData): Uint8Array {
  const gray = new Uint8Array(image.width * image.height)
  const data = image.data
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4
    gray[i] = luminance(data[p], data[p + 1], data[p + 2])
  }
  return gray
}

/** La componente connessa più grande di una maschera binaria (4-connessa). */
function largestComponent(mask: Uint8Array, w: number): { pixels: Int32Array; size: number } | null {
  const labels = new Int32Array(mask.length) // 0 = non visitato
  const stack = new Int32Array(mask.length)
  let best: { start: number; size: number } | null = null
  let label = 0
  for (let seed = 0; seed < mask.length; seed++) {
    if (!mask[seed] || labels[seed]) continue
    label++
    let size = 0
    let top = 0
    stack[top++] = seed
    labels[seed] = label
    while (top > 0) {
      const p = stack[--top]
      size++
      const x = p % w
      if (x > 0 && mask[p - 1] && !labels[p - 1]) { labels[p - 1] = label; stack[top++] = p - 1 }
      if (x < w - 1 && mask[p + 1] && !labels[p + 1]) { labels[p + 1] = label; stack[top++] = p + 1 }
      if (p >= w && mask[p - w] && !labels[p - w]) { labels[p - w] = label; stack[top++] = p - w }
      if (p < mask.length - w && mask[p + w] && !labels[p + w]) { labels[p + w] = label; stack[top++] = p + w }
    }
    if (!best || size > best.size) best = { start: label, size }
  }
  if (!best) return null
  const pixels = new Int32Array(best.size)
  let n = 0
  for (let i = 0; i < labels.length; i++) if (labels[i] === best.start) pixels[n++] = i
  return { pixels, size: best.size }
}

/**
 * Angoli della componente: 8 punti estremi (assi + diagonali), poi tra le
 * combinazioni di 4 si sceglie il quadrilatero di area massima. Regge sia i
 * documenti quasi dritti sia quelli molto ruotati.
 */
function componentCorners(pixels: Int32Array, w: number): Quad {
  const directions: Array<[number, number]> = [
    [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
  ]
  const bestScore = new Array<number>(directions.length).fill(-Infinity)
  const bestPoint = new Array<number>(directions.length).fill(pixels[0])
  for (const p of pixels) {
    const x = p % w
    const y = (p - x) / w
    for (let d = 0; d < directions.length; d++) {
      const score = directions[d][0] * x + directions[d][1] * y
      if (score > bestScore[d]) {
        bestScore[d] = score
        bestPoint[d] = p
      }
    }
  }
  const candidates: Point[] = []
  for (const p of bestPoint) {
    const point = { x: p % w, y: Math.floor(p / w) }
    if (!candidates.some((c) => c.x === point.x && c.y === point.y)) candidates.push(point)
  }
  let best: Quad | null = null
  let bestArea = -1
  for (let i = 0; i < candidates.length - 3; i++)
    for (let j = i + 1; j < candidates.length - 2; j++)
      for (let k = j + 1; k < candidates.length - 1; k++)
        for (let l = k + 1; l < candidates.length; l++) {
          const quad = orderQuad([candidates[i], candidates[j], candidates[k], candidates[l]])
          const area = quadArea(quad)
          if (area > bestArea) {
            bestArea = area
            best = quad
          }
        }
  return best ?? orderQuad([candidates[0], candidates[0], candidates[0], candidates[0]])
}

/** Sfocatura 3×3 (media): riduce rumore e trame prima della sogliatura. */
export function boxBlur3(gray: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(gray.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      let count = 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w) continue
          sum += gray[yy * w + xx]
          count++
        }
      }
      out[y * w + x] = Math.round(sum / count)
    }
  }
  return out
}

/** Valore di luminanza al percentile richiesto (0..1) dell'istogramma. */
function percentileLevel(histogram: number[], total: number, pct: number): number {
  const target = total * pct
  let cumulative = 0
  for (let i = 0; i < 256; i++) {
    cumulative += histogram[i]
    if (cumulative >= target) return i
  }
  return 255
}

/**
 * Cerca il documento nella foto provando più soglie (Otsu + percentili, chiaro
 * e scuro): per ogni candidata prende la regione connessa più grande, ne stima
 * i 4 angoli e assegna un punteggio (area × riempimento). Vince il candidato
 * migliore; null se nessuno è affidabile.
 */
export function detectDocumentQuad(rawGray: Uint8Array, w: number, h: number): Quad | null {
  const gray = boxBlur3(rawGray, w, h)
  const histogram = new Array<number>(256).fill(0)
  for (let i = 0; i < gray.length; i++) histogram[gray[i]]++
  const total = gray.length
  const thresholds = Array.from(
    new Set([
      otsuThreshold(histogram, total),
      percentileLevel(histogram, total, 0.35),
      percentileLevel(histogram, total, 0.65),
    ]),
  )

  let best: Quad | null = null
  let bestScore = 0
  for (const threshold of thresholds) {
    for (const bright of [true, false]) {
      const mask = new Uint8Array(total)
      for (let i = 0; i < total; i++) {
        mask[i] = (bright ? gray[i] > threshold : gray[i] <= threshold) ? 1 : 0
      }
      const component = largestComponent(mask, w)
      if (!component) continue
      const ratio = component.size / total
      // Il documento deve occupare una parte sostanziale ma non tutta la foto.
      if (ratio < 0.15 || ratio > 0.97) continue
      const corners = componentCorners(component.pixels, w)
      const quad: Quad = [
        { x: corners[0].x / (w - 1), y: corners[0].y / (h - 1) },
        { x: corners[1].x / (w - 1), y: corners[1].y / (h - 1) },
        { x: corners[2].x / (w - 1), y: corners[2].y / (h - 1) },
        { x: corners[3].x / (w - 1), y: corners[3].y / (h - 1) },
      ]
      // Coerenza tra area del quadrilatero e regione trovata (niente forme a L).
      const area = quadArea(quad)
      if (area < 0.12) continue
      const fill = component.size / (area * total)
      if (fill < 0.72) continue
      const score = area * Math.min(fill, 1)
      if (score > bestScore) {
        bestScore = score
        best = quad
      }
    }
  }
  return best
}
