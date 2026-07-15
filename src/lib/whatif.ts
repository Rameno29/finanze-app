import { MONTH_NAMES } from './format'

/**
 * Simulatore "what-if": proietta il patrimonio nei prossimi mesi partendo dal
 * ritmo reale (media di entrate e uscite degli ultimi mesi completi) e lo
 * confronta con uno scenario (risparmio in più o spesa in più al mese).
 * Tutta matematica deterministica lato client, in centesimi.
 */

export interface MonthlyTotal {
  /** "YYYY-MM" */
  month: string
  income: number
  expense: number
}

/** Media di entrate/uscite sui mesi COMPLETI (esclude il mese corrente, parziale). */
export function averageMonthlyFlows(
  history: MonthlyTotal[],
  currentMonth: string,
): { income: number; expense: number; monthsUsed: number } {
  const complete = history.filter((h) => h.month !== currentMonth && (h.income > 0 || h.expense > 0))
  if (complete.length === 0) return { income: 0, expense: 0, monthsUsed: 0 }
  const income = complete.reduce((sum, h) => sum + h.income, 0)
  const expense = complete.reduce((sum, h) => sum + h.expense, 0)
  return {
    income: Math.round(income / complete.length),
    expense: Math.round(expense / complete.length),
    monthsUsed: complete.length,
  }
}

export interface WhatIfPoint {
  /** Etichetta breve del mese (es. "Ago 26") */
  label: string
  /** Patrimonio previsto senza scenario, in centesimi */
  baseline: number
  /** Patrimonio previsto con lo scenario, in centesimi */
  scenario: number
}

export interface WhatIfProjection {
  points: WhatIfPoint[]
  baselineEnd: number
  scenarioEnd: number
  /** Differenza a fine periodo (scenario − baseline), in centesimi */
  difference: number
  /** Risparmio mensile di partenza (entrate − uscite medie), in centesimi */
  monthlyNet: number
}

/**
 * Proietta mese per mese. `monthlyDeltaCents` è lo scenario: positivo = metti
 * via di più ogni mese, negativo = nuova spesa ricorrente (es. rata −200 €).
 */
export function projectWhatIf(
  startingBalanceCents: number,
  avgIncomeCents: number,
  avgExpenseCents: number,
  monthlyDeltaCents: number,
  months: number,
  from = new Date(),
): WhatIfProjection {
  const horizon = Math.min(Math.max(Math.round(months), 1), 120)
  const monthlyNet = avgIncomeCents - avgExpenseCents
  const points: WhatIfPoint[] = []
  for (let m = 0; m <= horizon; m++) {
    const date = new Date(from.getFullYear(), from.getMonth() + m, 1)
    points.push({
      label: `${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${String(date.getFullYear()).slice(2)}`,
      baseline: startingBalanceCents + monthlyNet * m,
      scenario: startingBalanceCents + (monthlyNet + monthlyDeltaCents) * m,
    })
  }
  const last = points[points.length - 1]
  return {
    points,
    baselineEnd: last.baseline,
    scenarioEnd: last.scenario,
    difference: last.scenario - last.baseline,
    monthlyNet,
  }
}

/** Dopo quanti mesi lo scenario raggiunge un traguardo (null = mai entro 10 anni). */
export function monthsToReach(
  targetCents: number,
  startingBalanceCents: number,
  monthlyNetCents: number,
): number | null {
  if (startingBalanceCents >= targetCents) return 0
  if (monthlyNetCents <= 0) return null
  const months = Math.ceil((targetCents - startingBalanceCents) / monthlyNetCents)
  return months > 120 ? null : months
}
