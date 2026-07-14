import { describe, expect, it } from 'vitest'
import {
  detectDelimiter,
  guessMapping,
  markDuplicates,
  parseCsv,
  parseEntries,
  parseImportDate,
  parseSignedAmountCents,
  suggestCategoryId,
} from './csvImport'

describe('detectDelimiter', () => {
  it('riconosce punto e virgola, virgola e tab', () => {
    expect(detectDelimiter('Data;Descrizione;Importo')).toBe(';')
    expect(detectDelimiter('Date,Description,Amount')).toBe(',')
    expect(detectDelimiter('Data\tDescrizione\tImporto')).toBe('\t')
  })

  it('ignora i delimitatori dentro le virgolette', () => {
    expect(detectDelimiter('"a;b",c,d')).toBe(',')
  })
})

describe('parseCsv', () => {
  it('estrae intestazione e righe', () => {
    const table = parseCsv('Data;Importo\r\n01/07/2026;-12,50\r\n02/07/2026;100,00\r\n')
    expect(table.header).toEqual(['Data', 'Importo'])
    expect(table.rows).toEqual([
      ['01/07/2026', '-12,50'],
      ['02/07/2026', '100,00'],
    ])
  })

  it('gestisce virgolette, delimitatori interni e virgolette doppie', () => {
    const table = parseCsv('a;b\n"testo; con punto e virgola";"citazione ""interna"""')
    expect(table.rows).toEqual([['testo; con punto e virgola', 'citazione "interna"']])
  })

  it('salta righe vuote e BOM iniziale', () => {
    const table = parseCsv('﻿Data;Importo\n\n01/07/2026;5\n;\n')
    expect(table.rows).toEqual([['01/07/2026', '5']])
  })
})

describe('guessMapping', () => {
  it('riconosce le colonne di un estratto conto italiano con dare/avere', () => {
    const mapping = guessMapping(['Data contabile', 'Data valuta', 'Causale', 'Addebiti', 'Accrediti'])
    expect(mapping.date).toBe(0)
    expect(mapping.description).toBe(2)
    expect(mapping.debit).toBe(3)
    expect(mapping.credit).toBe(4)
    expect(mapping.amount).toBeNull()
  })

  it('riconosce la colonna con importo unico', () => {
    const mapping = guessMapping(['Data', 'Descrizione', 'Importo (EUR)'])
    expect(mapping).toEqual({ date: 0, description: 1, amount: 2, debit: null, credit: null })
  })

  it('restituisce null per colonne non trovate', () => {
    expect(guessMapping(['x', 'y']).date).toBeNull()
  })
})

describe('parseImportDate', () => {
  it('accetta i formati comuni', () => {
    expect(parseImportDate('31/12/2026')).toBe('2026-12-31')
    expect(parseImportDate('1/7/2026')).toBe('2026-07-01')
    expect(parseImportDate('31-12-2026')).toBe('2026-12-31')
    expect(parseImportDate('31.12.2026')).toBe('2026-12-31')
    expect(parseImportDate('2026-12-31')).toBe('2026-12-31')
    expect(parseImportDate('05/07/26')).toBe('2026-07-05')
  })

  it('rifiuta date inesistenti o malformate', () => {
    expect(parseImportDate('31/02/2026')).toBeNull()
    expect(parseImportDate('2026')).toBeNull()
    expect(parseImportDate('abc')).toBeNull()
    expect(parseImportDate('')).toBeNull()
  })
})

describe('parseSignedAmountCents', () => {
  it('accetta formati italiani e internazionali con segno', () => {
    expect(parseSignedAmountCents('-12,50')).toBe(-1250)
    expect(parseSignedAmountCents('1.234,56')).toBe(123456)
    expect(parseSignedAmountCents('1,234.56')).toBe(123456)
    expect(parseSignedAmountCents('+100')).toBe(10000)
    expect(parseSignedAmountCents('12,50-')).toBe(-1250)
    expect(parseSignedAmountCents('€ 45,00')).toBe(4500)
  })

  it('rifiuta valori non numerici', () => {
    expect(parseSignedAmountCents('')).toBeNull()
    expect(parseSignedAmountCents('abc')).toBeNull()
    expect(parseSignedAmountCents('12,345')).toBeNull()
  })
})

describe('parseEntries', () => {
  it('interpreta importo unico firmato', () => {
    const table = parseCsv('Data;Descrizione;Importo\n01/07/2026;Supermercato;-25,00\n02/07/2026;Stipendio;1.500,00')
    const entries = parseEntries(table, guessMapping(table.header))
    expect(entries[0]).toMatchObject({ date: '2026-07-01', amount_cents: 2500, kind: 'expense', error: null })
    expect(entries[1]).toMatchObject({ date: '2026-07-02', amount_cents: 150000, kind: 'income', error: null })
  })

  it('interpreta colonne separate dare/avere', () => {
    const table = parseCsv('Data;Causale;Addebiti;Accrediti\n01/07/2026;Bar;4,50;\n02/07/2026;Bonifico;;200,00')
    const entries = parseEntries(table, guessMapping(table.header))
    expect(entries[0]).toMatchObject({ amount_cents: 450, kind: 'expense' })
    expect(entries[1]).toMatchObject({ amount_cents: 20000, kind: 'income' })
  })

  it('segnala le righe non interpretabili', () => {
    const table = parseCsv('Data;Descrizione;Importo\nboh;x;-1,00\n01/07/2026;y;zero')
    const entries = parseEntries(table, guessMapping(table.header))
    expect(entries[0].error).toBe('Data non riconosciuta')
    expect(entries[1].error).toBe('Importo non riconosciuto')
  })
})

describe('markDuplicates', () => {
  const entry = (row: number, date: string, cents: number) => ({
    row,
    date,
    description: '',
    amount_cents: cents,
    kind: 'expense' as const,
    error: null,
  })

  it('segna solo le voci già presenti, una volta per movimento esistente', () => {
    const existing = [{ date: '2026-07-01', amount_cents: 2500, kind: 'expense' as const }]
    const duplicates = markDuplicates(
      [entry(0, '2026-07-01', 2500), entry(1, '2026-07-01', 2500), entry(2, '2026-07-02', 2500)],
      existing,
    )
    expect(duplicates).toEqual(new Set([0]))
  })
})

describe('suggestCategoryId', () => {
  const history = [
    { description: 'Spesa Esselunga settimanale', category_id: 'cat-spesa', kind: 'expense' as const },
    { description: 'Esselunga viale Roma', category_id: 'cat-spesa', kind: 'expense' as const },
    { description: 'Benzina Eni', category_id: 'cat-auto', kind: 'expense' as const },
  ]

  it('propone la categoria con più parole in comune nello storico', () => {
    expect(suggestCategoryId('PAGAMENTO POS ESSELUNGA MILANO', 'expense', history)).toBe('cat-spesa')
    expect(suggestCategoryId('Rifornimento benzina', 'expense', history)).toBe('cat-auto')
  })

  it('restituisce null senza corrispondenze o per tipo diverso', () => {
    expect(suggestCategoryId('Palestra', 'expense', history)).toBeNull()
    expect(suggestCategoryId('Esselunga', 'income', history)).toBeNull()
  })
})
