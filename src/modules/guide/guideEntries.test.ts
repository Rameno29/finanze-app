import { describe, expect, it } from 'vitest'
import { GUIDE_ENTRIES, searchGuide } from './guideEntries'

describe('ricerca nella guida', () => {
  it('ignora maiuscole e accenti e richiede tutte le parole', () => {
    const ids = searchGuide(GUIDE_ENTRIES, 'CATEGORIE budget', null).map((e) => e.id)
    expect(ids).toContain('budget')
    expect(searchGuide(GUIDE_ENTRIES, 'attivita calendario', null).map((e) => e.id)).toContain('agenda')
  })

  it('filtra per categoria e restituisce vuoto se niente corrisponde', () => {
    expect(searchGuide(GUIDE_ENTRIES, '', 'Documenti').every((e) => e.category === 'Documenti')).toBe(true)
    expect(searchGuide(GUIDE_ENTRIES, 'zzzz', null)).toEqual([])
  })

  it('contiene la voce sull’installazione, usata da /guida?q=install', () => {
    expect(GUIDE_ENTRIES.some((e) => e.id === 'install')).toBe(true)
    expect(searchGuide(GUIDE_ENTRIES, 'PDF', null).length).toBeGreaterThan(0)
    expect(searchGuide(GUIDE_ENTRIES, 'offline', null).length).toBeGreaterThan(0)
  })
})
