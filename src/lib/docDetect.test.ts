import { describe, expect, it } from 'vitest'

// L'ambiente di test Node non ha ImageData: polyfill minimo equivalente.
class FakeImageData {
  width: number
  height: number
  data: Uint8ClampedArray
  constructor(w: number, h: number) {
    this.width = w
    this.height = h
    this.data = new Uint8ClampedArray(w * h * 4)
  }
}
;(globalThis as { ImageData?: unknown }).ImageData ??= FakeImageData
import {
  boxBlur3,
  closeMask,
  detectDocumentQuad,
  edgeAlignment,
  homographyToQuad,
  orderQuad,
  quadArea,
  quadOutputSize,
  sobelMagnitude,
  warpPerspective,
  type Point,
  type Quad,
} from './docDetect'

describe('orderQuad', () => {
  it('ordina i punti come TL, TR, BR, BL in qualsiasi ordine arrivino', () => {
    const shuffled: Point[] = [
      { x: 9, y: 8 },
      { x: 1, y: 0 },
      { x: 10, y: 1 },
      { x: 0, y: 9 },
    ]
    const quad = orderQuad(shuffled)
    expect(quad[0]).toEqual({ x: 1, y: 0 })
    expect(quad[1]).toEqual({ x: 10, y: 1 })
    expect(quad[2]).toEqual({ x: 9, y: 8 })
    expect(quad[3]).toEqual({ x: 0, y: 9 })
  })
})

describe('quadArea', () => {
  it('calcola l’area normalizzata', () => {
    const half: Quad = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.5 },
      { x: 0, y: 0.5 },
    ]
    expect(quadArea(half)).toBeCloseTo(0.5, 5)
  })
})

describe('homographyToQuad', () => {
  it('con un quadrilatero rettangolare è una scala pura', () => {
    const quad: Quad = [
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 220 },
      { x: 10, y: 220 },
    ]
    const [a, b, c, d, e, f, g, h] = homographyToQuad(50, 100, quad)
    // Centro del rettangolo di uscita → centro del quadrilatero
    const u = 25, v = 50
    const den = g * u + h * v + 1
    expect((a * u + b * v + c) / den).toBeCloseTo(60, 3)
    expect((d * u + e * v + f) / den).toBeCloseTo(120, 3)
  })

  it('mappa esattamente i 4 angoli', () => {
    const quad: Quad = [
      { x: 5, y: 3 },
      { x: 90, y: 12 },
      { x: 82, y: 130 },
      { x: 12, y: 118 },
    ]
    const [a, b, c, d, e, f, g, h] = homographyToQuad(60, 90, quad)
    const corners = [
      [0, 0, quad[0]],
      [60, 0, quad[1]],
      [60, 90, quad[2]],
      [0, 90, quad[3]],
    ] as const
    for (const [u, v, expected] of corners) {
      const den = g * u + h * v + 1
      expect((a * u + b * v + c) / den).toBeCloseTo(expected.x, 3)
      expect((d * u + e * v + f) / den).toBeCloseTo(expected.y, 3)
    }
  })
})

describe('quadOutputSize', () => {
  it('usa i lati del quadrilatero e rispetta il limite', () => {
    const quad: Quad = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 800 },
      { x: 0, y: 800 },
    ]
    expect(quadOutputSize(quad, 2000)).toEqual({ w: 400, h: 800 })
    expect(quadOutputSize(quad, 400)).toEqual({ w: 200, h: 400 })
  })
})

/** ImageData sintetica w×h con pixel dal callback (r=g=b). */
function grayImage(w: number, h: number, value: (x: number, y: number) => number): ImageData {
  const image = new ImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = value(x, y)
      const p = (y * w + x) * 4
      image.data[p] = image.data[p + 1] = image.data[p + 2] = v
      image.data[p + 3] = 255
    }
  }
  return image
}

describe('warpPerspective', () => {
  it('con il quadrilatero pieno riproduce l’immagine (metà chiara / metà scura)', () => {
    const src = grayImage(20, 20, (x) => (x < 10 ? 40 : 200))
    const quad: Quad = [
      { x: 0, y: 0 },
      { x: 19, y: 0 },
      { x: 19, y: 19 },
      { x: 0, y: 19 },
    ]
    const out = warpPerspective(src, quad, 20, 20)
    expect(out.data[(10 * 20 + 2) * 4]).toBeLessThan(80) // sinistra scura
    expect(out.data[(10 * 20 + 17) * 4]).toBeGreaterThan(160) // destra chiara
  })

  it('raddrizza una regione ruotata: il contenuto del quadrilatero riempie l’uscita', () => {
    // Documento chiaro a rombo su sfondo nero
    const src = grayImage(40, 40, (x, y) => (Math.abs(x - 20) + Math.abs(y - 20) <= 15 ? 220 : 0))
    const quad: Quad = [
      { x: 20, y: 5 },
      { x: 35, y: 20 },
      { x: 20, y: 35 },
      { x: 5, y: 20 },
    ]
    const out = warpPerspective(src, quad, 30, 30)
    // Il centro e i punti interni ora sono tutti "carta"
    expect(out.data[(15 * 30 + 15) * 4]).toBeGreaterThan(180)
    expect(out.data[(5 * 30 + 5) * 4]).toBeGreaterThan(140)
    expect(out.data[(25 * 30 + 25) * 4]).toBeGreaterThan(140)
  })
})

describe('detectDocumentQuad', () => {
  it('trova un documento chiaro su sfondo scuro', () => {
    const w = 80, h = 60
    const gray = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        gray[y * w + x] = x >= 12 && x <= 68 && y >= 9 && y <= 51 ? 210 : 25
      }
    }
    const quad = detectDocumentQuad(gray, w, h)
    expect(quad).not.toBeNull()
    expect(quad![0].x).toBeCloseTo(12 / 79, 1)
    expect(quad![0].y).toBeCloseTo(9 / 59, 1)
    expect(quad![2].x).toBeCloseTo(68 / 79, 1)
    expect(quad![2].y).toBeCloseTo(51 / 59, 1)
  })

  it('trova anche un documento ruotato (rombo)', () => {
    const w = 80, h = 80
    const gray = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        gray[y * w + x] = Math.abs(x - 40) + Math.abs(y - 40) <= 30 ? 220 : 20
      }
    }
    const quad = detectDocumentQuad(gray, w, h)
    expect(quad).not.toBeNull()
    // Gli estremi del rombo: alto (40,10), destra (70,40), basso (40,70), sinistra (10,40)
    const xs = quad!.map((p) => Math.round(p.x * (w - 1)))
    const ys = quad!.map((p) => Math.round(p.y * (h - 1)))
    expect(Math.min(...xs)).toBeLessThanOrEqual(12)
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(68)
    expect(Math.min(...ys)).toBeLessThanOrEqual(12)
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(68)
  })

  it('restituisce null se non c’è un documento distinguibile', () => {
    const gray = new Uint8Array(80 * 60).fill(128)
    expect(detectDocumentQuad(gray, 80, 60)).toBeNull()
  })

  it('trova l’intero documento anche con un’ombra su un lato', () => {
    const w = 80, h = 60
    const gray = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const inside = x >= 12 && x <= 66 && y >= 9 && y <= 51
        // Banda destra del foglio in ombra (più scura ma sopra lo sfondo).
        gray[y * w + x] = inside ? (x >= 54 ? 70 : 210) : 25
      }
    }
    const quad = detectDocumentQuad(gray, w, h)
    expect(quad).not.toBeNull()
    const xs = quad!.map((p) => p.x)
    const ys = quad!.map((p) => p.y)
    // Il bordo destro deve arrivare al vero bordo del foglio, non fermarsi all’ombra.
    expect(Math.max(...xs)).toBeGreaterThan(0.78)
    expect(Math.min(...xs)).toBeLessThan(0.22)
    expect(Math.max(...ys)).toBeGreaterThan(0.78)
    expect(Math.min(...ys)).toBeLessThan(0.22)
  })

  it('trova un documento a basso contrasto nonostante il rumore', () => {
    const w = 80, h = 60
    const gray = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const noise = ((x + y) % 2) * 14 // trama a scacchiera
        gray[y * w + x] = (x >= 14 && x <= 66 && y >= 10 && y <= 50 ? 135 : 100) + noise
      }
    }
    const quad = detectDocumentQuad(gray, w, h)
    expect(quad).not.toBeNull()
    expect(quad![0].x).toBeCloseTo(14 / 79, 1)
    expect(quad![2].y).toBeCloseTo(50 / 59, 1)
  })
})

describe('closeMask', () => {
  it('riempie un buco isolato (come il testo dentro il foglio)', () => {
    const w = 9, h = 9
    const mask = new Uint8Array(w * h).fill(1)
    mask[4 * w + 4] = 0 // singolo pixel spento
    const closed = closeMask(mask, w, h, 1)
    expect(closed[4 * w + 4]).toBe(1)
  })

  it('lascia invariate maschere piene o vuote', () => {
    expect(Array.from(closeMask(new Uint8Array(25).fill(1), 5, 5, 1))).toEqual(new Array(25).fill(1))
    expect(Array.from(closeMask(new Uint8Array(25).fill(0), 5, 5, 1))).toEqual(new Array(25).fill(0))
  })

  it('ricuce una rientranza sottile sul bordo (come un’ombra)', () => {
    const w = 11, h = 11
    const mask = new Uint8Array(w * h)
    for (let y = 2; y <= 8; y++) for (let x = 2; x <= 8; x++) mask[y * w + x] = 1
    mask[5 * w + 8] = 0 // tacca di 1px sul bordo destro
    const closed = closeMask(mask, w, h, 1)
    expect(closed[5 * w + 8]).toBe(1)
  })
})

describe('sobelMagnitude', () => {
  it('è forte sui bordi e nulla nelle zone piatte', () => {
    const w = 6, h = 6
    const gray = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) gray[y * w + x] = x < 3 ? 0 : 255
    const mag = sobelMagnitude(gray, w, h)
    expect(mag[2 * w + 2]).toBeGreaterThan(500) // a cavallo del bordo
    expect(mag[2 * w + 1]).toBe(0) // zona piatta scura
    expect(mag[2 * w + 4]).toBe(0) // zona piatta chiara
  })
})

describe('edgeAlignment', () => {
  it('premia il quad che segue i bordi reali del documento', () => {
    const w = 80, h = 60
    const gray = new Uint8Array(w * h)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        gray[y * w + x] = x >= 14 && x <= 66 && y >= 10 && y <= 50 ? 200 : 30
    const mag = sobelMagnitude(gray, w, h)
    let maxMag = 1
    for (let i = 0; i < mag.length; i++) if (mag[i] > maxMag) maxMag = mag[i]
    const onBorder: Quad = [
      { x: 14 / 79, y: 10 / 59 },
      { x: 66 / 79, y: 10 / 59 },
      { x: 66 / 79, y: 50 / 59 },
      { x: 14 / 79, y: 50 / 59 },
    ]
    const offBorder: Quad = [
      { x: 0.4, y: 0.4 },
      { x: 0.6, y: 0.4 },
      { x: 0.6, y: 0.6 },
      { x: 0.4, y: 0.6 },
    ]
    expect(edgeAlignment(onBorder, mag, w, h, maxMag)).toBeGreaterThan(
      edgeAlignment(offBorder, mag, w, h, maxMag) + 0.2,
    )
  })
})

describe('boxBlur3', () => {
  it('attenua un pixel isolato distribuendolo sui vicini', () => {
    const w = 5, h = 5
    const gray = new Uint8Array(w * h)
    gray[2 * w + 2] = 90
    const out = boxBlur3(gray, w, h)
    expect(out[2 * w + 2]).toBe(10) // 90 / 9
    expect(out[1 * w + 1]).toBe(10)
    expect(out[0]).toBe(0)
  })

  it('lascia invariata un’immagine uniforme (bordi inclusi)', () => {
    const gray = new Uint8Array(16).fill(77)
    expect(Array.from(boxBlur3(gray, 4, 4))).toEqual(new Array(16).fill(77))
  })
})
