import { describe, expect, it } from 'vitest'
import {
  applyFilter,
  fitOnA4,
  luminance,
  otsuThreshold,
  percentileBounds,
} from './scanner'

/** Buffer RGBA da una lista di pixel [r,g,b]. */
function rgba(pixels: Array<[number, number, number]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(pixels.length * 4)
  pixels.forEach(([r, g, b], i) => {
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = 255
  })
  return data
}

describe('luminance', () => {
  it('pesa i canali in modo percettivo', () => {
    expect(luminance(255, 255, 255)).toBe(255)
    expect(luminance(0, 0, 0)).toBe(0)
    expect(luminance(0, 255, 0)).toBeGreaterThan(luminance(0, 0, 255))
  })
})

describe('otsuThreshold', () => {
  it('separa due gruppi ben distinti (inchiostro e carta)', () => {
    const histogram = new Array(256).fill(0)
    histogram[30] = 400 // inchiostro
    histogram[220] = 600 // carta
    const threshold = otsuThreshold(histogram, 1000)
    expect(threshold).toBeGreaterThanOrEqual(30)
    expect(threshold).toBeLessThan(220)
  })

  it('con istogramma vuoto restituisce il valore neutro', () => {
    expect(otsuThreshold(new Array(256).fill(0), 0)).toBe(128)
  })
})

describe('percentileBounds', () => {
  it('ignora le code estreme dell’istogramma', () => {
    const histogram = new Array(256).fill(0)
    histogram[0] = 5 // pochi pixel bruciati in ombra
    histogram[80] = 500
    histogram[180] = 490
    histogram[255] = 5 // pochi riflessi
    const { low, high } = percentileBounds(histogram, 1000)
    expect(low).toBe(80)
    expect(high).toBe(180)
  })

  it('degrada in modo sicuro con dati piatti', () => {
    expect(percentileBounds(new Array(256).fill(0), 0)).toEqual({ low: 0, high: 255 })
  })
})

describe('applyFilter', () => {
  it('"grigio" rende i tre canali uguali alla luminanza', () => {
    const data = rgba([[200, 100, 50]])
    applyFilter(data, 'grigio')
    expect(data[0]).toBe(data[1])
    expect(data[1]).toBe(data[2])
    expect(data[0]).toBe(luminance(200, 100, 50))
  })

  it('"bn" porta ogni pixel a bianco o nero puro', () => {
    const data = rgba([
      [30, 30, 30],
      [220, 220, 220],
      [40, 40, 40],
      [210, 210, 210],
    ])
    applyFilter(data, 'bn')
    for (let i = 0; i < data.length; i += 4) {
      expect([0, 255]).toContain(data[i])
    }
    expect(data[0]).toBe(0)
    expect(data[4]).toBe(255)
  })

  it('"migliorato" aumenta il contrasto (stira verso gli estremi)', () => {
    const pixels: Array<[number, number, number]> = []
    for (let i = 0; i < 60; i++) pixels.push([90, 90, 90])
    for (let i = 0; i < 60; i++) pixels.push([170, 170, 170])
    const data = rgba(pixels)
    applyFilter(data, 'migliorato')
    expect(data[0]).toBeLessThan(40)
    expect(data[60 * 4]).toBeGreaterThan(220)
  })

  it('"originale" non tocca i pixel', () => {
    const data = rgba([[12, 34, 56]])
    applyFilter(data, 'originale')
    expect([data[0], data[1], data[2]]).toEqual([12, 34, 56])
  })
})

describe('fitOnA4', () => {
  it('adatta un ritratto ai margini mantenendo le proporzioni', () => {
    const { x, y, w, h } = fitOnA4(1000, 1414)
    expect(w).toBeCloseTo(194, 0)
    expect(h).toBeCloseTo(274.3, 0)
    expect(w / h).toBeCloseTo(1000 / 1414, 2)
    expect(x).toBeCloseTo(8, 0)
    expect(y).toBeCloseTo((297 - h) / 2, 1)
  })

  it('adatta un panorama centrandolo in verticale', () => {
    const { y, w, h } = fitOnA4(2000, 1000)
    expect(w).toBeCloseTo(194, 0)
    expect(h).toBeCloseTo(97, 0)
    expect(y).toBeCloseTo((297 - h) / 2, 1)
  })
})
