const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

export function formatCents(cents: number): string {
  return eur.format(cents / 100)
}

/** "1.234,56" | "1234.56" | "12" -> centesimi (int) oppure null se non valido */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.trim().replace(/\s|€/g, '')
  if (!cleaned) return null
  // Accetta italiano (1.234,56) e internazionale (1,234.56), ma rifiuta
  // separatori ambigui/malformati invece di salvare un importo diverso.
  if (!/^\d[\d.,]*$/.test(cleaned)) return null
  const italian = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)
  const international = /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)
  const plainItalian = /^\d+(,\d{1,2})?$/.test(cleaned)
  const plainInternational = /^\d+(\.\d{1,2})?$/.test(cleaned)
  let normalized: string
  if (italian) normalized = cleaned.replace(/\./g, '').replace(',', '.')
  else if (international) normalized = cleaned.replace(/,/g, '')
  else if (plainItalian) normalized = cleaned.replace(',', '.')
  else if (plainInternational) normalized = cleaned
  else return null
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100)
}

export const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

/** yyyy-mm-dd della data odierna (fuso locale) */
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDay(dateISO: string): string {
  const d = new Date(dateISO + 'T00:00:00')
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Primo e ultimo giorno (ISO) del mese richiesto */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}
