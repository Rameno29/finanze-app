import { describe, expect, it } from 'vitest'
import { averageMonthlyFlows, monthsToReach, projectWhatIf } from './whatif'

describe('averageMonthlyFlows', () => {
  const history = [
    { month: '2026-05', income: 200000, expense: 150000 },
    { month: '2026-06', income: 220000, expense: 130000 },
    { month: '2026-07', income: 50000, expense: 20000 }, // mese corrente, parziale
  ]

  it('esclude il mese corrente e fa la media dei mesi completi', () => {
    expect(averageMonthlyFlows(history, '2026-07')).toEqual({
      income: 210000,
      expense: 140000,
      monthsUsed: 2,
    })
  })

  it('ignora i mesi senza movimenti', () => {
    const withEmpty = [{ month: '2026-04', income: 0, expense: 0 }, ...history]
    expect(averageMonthlyFlows(withEmpty, '2026-07').monthsUsed).toBe(2)
  })

  it('senza storico restituisce zero', () => {
    expect(averageMonthlyFlows([], '2026-07')).toEqual({ income: 0, expense: 0, monthsUsed: 0 })
  })
})

describe('projectWhatIf', () => {
  it('proietta baseline e scenario mese per mese', () => {
    // Parti da 1000 €, risparmi 100 €/mese; scenario: +50 €/mese in più
    const projection = projectWhatIf(100000, 200000, 190000, 5000, 12, new Date(2026, 6, 15))
    expect(projection.monthlyNet).toBe(10000)
    expect(projection.points).toHaveLength(13)
    expect(projection.points[0]).toMatchObject({ baseline: 100000, scenario: 100000 })
    expect(projection.baselineEnd).toBe(100000 + 10000 * 12)
    expect(projection.scenarioEnd).toBe(100000 + 15000 * 12)
    expect(projection.difference).toBe(60000)
    expect(projection.points[1].label).toBe('Ago 26')
  })

  it('gestisce scenari negativi (nuova spesa mensile)', () => {
    const projection = projectWhatIf(0, 150000, 140000, -20000, 6)
    expect(projection.scenarioEnd).toBe((10000 - 20000) * 6)
    expect(projection.difference).toBe(-120000)
  })

  it('limita l’orizzonte a valori sensati', () => {
    expect(projectWhatIf(0, 0, 0, 0, 0).points).toHaveLength(2)
    expect(projectWhatIf(0, 0, 0, 0, 999).points).toHaveLength(121)
  })
})

describe('monthsToReach', () => {
  it('calcola i mesi necessari a un traguardo', () => {
    expect(monthsToReach(100000, 0, 10000)).toBe(10)
    expect(monthsToReach(100000, 95000, 10000)).toBe(1)
    expect(monthsToReach(100000, 100000, 0)).toBe(0)
  })

  it('restituisce null se il traguardo è irraggiungibile', () => {
    expect(monthsToReach(100000, 0, 0)).toBeNull()
    expect(monthsToReach(100000, 0, -5000)).toBeNull()
    expect(monthsToReach(10000000, 0, 100)).toBeNull()
  })
})
