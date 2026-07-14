import type { Kind, Transaction } from '../types'

/**
 * Import di estratti conto CSV: parsing, riconoscimento automatico delle colonne,
 * date e importi in formato italiano o internazionale, segnalazione dei possibili
 * duplicati e suggerimento della categoria dallo storico dei movimenti.
 * Tutto lato client: il file non lascia mai il dispositivo.
 */

export interface CsvTable {
  header: string[]
  rows: string[][]
}

const DELIMITERS = [';', ',', '\t'] as const

/** Conta le occorrenze di un delimitatore fuori dalle virgolette. */
function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0
  let inQuotes = false
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes
    else if (char === delimiter && !inQuotes) count++
  }
  return count
}

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? ''
  let best: string = DELIMITERS[0]
  let bestCount = -1
  for (const delimiter of DELIMITERS) {
    const count = countOutsideQuotes(firstLine, delimiter)
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  }
  return best
}

/** Parser CSV (stile RFC 4180): virgolette, delimitatori nel testo, righe multiple. */
export function parseCsv(text: string): CsvTable {
  const clean = text.replace(/^﻿/, '')
  const delimiter = detectDelimiter(clean)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]
    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += char
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
    } else {
      field += char
    }
  }
  row.push(field)
  if (row.some((cell) => cell.trim() !== '')) rows.push(row)
  const [header = [], ...body] = rows
  return { header: header.map((h) => h.trim()), rows: body }
}

export interface ColumnMapping {
  date: number | null
  description: number | null
  /** Colonna con importo unico firmato (negativo = uscita). */
  amount: number | null
  /** Colonne separate per uscite/entrate (tipico degli estratti conto italiani). */
  debit: number | null
  credit: number | null
}

function findColumn(header: string[], patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const index = header.findIndex((h) => pattern.test(h.toLowerCase()))
    if (index !== -1) return index
  }
  return null
}

/** Prova a riconoscere le colonne dai nomi usati dalle banche italiane più comuni. */
export function guessMapping(header: string[]): ColumnMapping {
  const date = findColumn(header, [
    /^data\s*(contabile|operazione|valuta)?$/,
    /^(booking\s*)?date$/,
    /data/,
  ])
  const description = findColumn(header, [
    /descrizione|causale|dettagl|operazione$/,
    /description|merchant|esercente|beneficiario/,
  ])
  const debit = findColumn(header, [/addebit|uscite|dare|^debit/])
  const credit = findColumn(header, [/accredit|entrate|avere|^credit/])
  const amount = findColumn(header, [/^importo(\s*\(?(eur|€)\)?)?$/, /^amount$/, /importo/])
  // Se esistono colonne separate dare/avere, hanno la precedenza sull'importo unico.
  const separate = debit !== null && credit !== null && debit !== credit
  return {
    date,
    description,
    amount: separate ? null : amount,
    debit: separate ? debit : null,
    credit: separate ? credit : null,
  }
}

/** "31/12/2026" | "31-12-2026" | "31.12.2026" | "2026-12-31" | "31/12/26" -> ISO, altrimenti null */
export function parseImportDate(raw: string): string | null {
  const value = raw.trim()
  let year: number, month: number, day: number
  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    year = Number(match[1])
    month = Number(match[2])
    day = Number(match[3])
  } else {
    match = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/)
    if (!match) return null
    day = Number(match[1])
    month = Number(match[2])
    year = Number(match[3])
    if (year < 100) year += 2000
  }
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Importo firmato -> centesimi. Accetta "1.234,56", "-12,50", "1,234.56", "€",
 * spazi e segno anche in coda ("12,50-"). Restituisce null se non interpretabile.
 */
export function parseSignedAmountCents(raw: string): number | null {
  let value = raw.trim().replace(/\s|€|EUR/gi, '')
  if (!value) return null
  let sign = 1
  if (value.startsWith('+')) value = value.slice(1)
  else if (value.startsWith('-')) {
    sign = -1
    value = value.slice(1)
  } else if (value.endsWith('-')) {
    sign = -1
    value = value.slice(0, -1)
  }
  if (!/^\d[\d.,]*$/.test(value)) return null
  const lastComma = value.lastIndexOf(',')
  const lastDot = value.lastIndexOf('.')
  let normalized: string
  if (lastComma === -1 && lastDot === -1) normalized = value
  else if (lastComma > lastDot) normalized = value.replace(/\./g, '').replace(',', '.')
  else normalized = value.replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const cents = Math.round(Number(normalized) * 100)
  if (!Number.isFinite(cents)) return null
  return sign * cents
}

export interface ImportEntry {
  /** Indice (0-based) della riga nel file, esclusa l'intestazione. */
  row: number
  date: string | null
  description: string
  /** Importo assoluto in centesimi. */
  amount_cents: number | null
  kind: Kind | null
  error: string | null
}

/** Applica la mappatura colonne alle righe: una voce per riga, con eventuale errore. */
export function parseEntries(table: CsvTable, mapping: ColumnMapping): ImportEntry[] {
  return table.rows.map((cells, row) => {
    const rawDate = mapping.date !== null ? (cells[mapping.date] ?? '') : ''
    const description = mapping.description !== null ? (cells[mapping.description] ?? '').trim() : ''
    const date = parseImportDate(rawDate)

    let amountCents: number | null = null
    let kind: Kind | null = null
    if (mapping.amount !== null) {
      const signed = parseSignedAmountCents(cells[mapping.amount] ?? '')
      if (signed !== null && signed !== 0) {
        amountCents = Math.abs(signed)
        kind = signed < 0 ? 'expense' : 'income'
      }
    } else if (mapping.debit !== null && mapping.credit !== null) {
      const debit = parseSignedAmountCents(cells[mapping.debit] ?? '')
      const credit = parseSignedAmountCents(cells[mapping.credit] ?? '')
      if (debit !== null && debit !== 0) {
        amountCents = Math.abs(debit)
        kind = 'expense'
      } else if (credit !== null && credit !== 0) {
        amountCents = Math.abs(credit)
        kind = 'income'
      }
    }

    let error: string | null = null
    if (!date) error = 'Data non riconosciuta'
    else if (amountCents === null || !kind) error = 'Importo non riconosciuto'
    return { row, date, description, amount_cents: amountCents, kind, error }
  })
}

/**
 * Segna come possibili duplicati le voci che coincidono (data, importo, tipo)
 * con movimenti già registrati. Restituisce gli indici `row` delle voci sospette.
 */
export function markDuplicates(
  entries: ImportEntry[],
  existing: Array<Pick<Transaction, 'date' | 'amount_cents' | 'kind'>>,
): Set<number> {
  const seen = new Map<string, number>()
  for (const t of existing) {
    const key = `${t.date}|${t.amount_cents}|${t.kind}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  const duplicates = new Set<number>()
  for (const entry of entries) {
    if (entry.error || !entry.date || !entry.amount_cents || !entry.kind) continue
    const key = `${entry.date}|${entry.amount_cents}|${entry.kind}`
    const remaining = seen.get(key) ?? 0
    if (remaining > 0) {
      duplicates.add(entry.row)
      seen.set(key, remaining - 1)
    }
  }
  return duplicates
}

function tokenize(description: string): string[] {
  return description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4)
}

/**
 * Suggerisce la categoria confrontando le parole della descrizione con lo storico:
 * vince la categoria più frequente tra i movimenti passati con parole in comune.
 */
export function suggestCategoryId(
  description: string,
  kind: Kind,
  history: Array<Pick<Transaction, 'description' | 'category_id' | 'kind'>>,
): string | null {
  const tokens = new Set(tokenize(description))
  if (tokens.size === 0) return null
  const scores = new Map<string, number>()
  for (const t of history) {
    if (t.kind !== kind || !t.category_id) continue
    const shared = tokenize(t.description).filter((token) => tokens.has(token)).length
    if (shared > 0) scores.set(t.category_id, (scores.get(t.category_id) ?? 0) + shared)
  }
  let best: string | null = null
  let bestScore = 0
  for (const [categoryId, score] of scores) {
    if (score > bestScore) {
      best = categoryId
      bestScore = score
    }
  }
  return best
}

/** Decodifica il file: UTF-8, con ripiego a Windows-1252 (comune nei CSV bancari). */
export async function readCsvFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  if (!utf8.includes('�')) return utf8
  try {
    return new TextDecoder('windows-1252').decode(buffer)
  } catch {
    return utf8
  }
}
