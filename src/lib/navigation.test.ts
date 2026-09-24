import { describe, expect, it } from 'vitest'
import { backFallback, barColumn, isSecondaryRoute, quickActionLabel, routeOrder } from './navigation'

describe('navigation', () => {
  it('assegna al "+" l’azione della scheda corrente', () => {
    expect(quickActionLabel('/')).toBe('Nuovo movimento')
    expect(quickActionLabel('/finanze')).toBe('Nuovo movimento')
    expect(quickActionLabel('/agenda')).toBe('Nuova attività')
    expect(quickActionLabel('/documenti')).toBe('Carica documento')
    expect(quickActionLabel('/carburanti')).toBe('Nuovo movimento')
  })

  it('colloca la pill attiva saltando la colonna del "+"', () => {
    expect([barColumn('/'), barColumn('/finanze'), barColumn('/agenda'), barColumn('/documenti')]).toEqual([0, 1, 3, 4])
    expect(barColumn('/impostazioni')).toBeNull()
  })

  it('ordina le rotte per la direzione della transizione', () => {
    expect(routeOrder('/finanze')).toBeGreaterThan(routeOrder('/'))
    expect(routeOrder('/documenti')).toBeGreaterThan(routeOrder('/agenda'))
    expect(routeOrder('/altro')).toBeGreaterThan(routeOrder('/documenti'))
    expect(routeOrder('/sconosciuta')).toBe(routeOrder('/'))
  })

  it('riconosce le pagine secondarie e il loro ritorno senza cronologia', () => {
    expect(isSecondaryRoute('/guida')).toBe(true)
    expect(isSecondaryRoute('/agenda')).toBe(false)
    expect(backFallback('/impostazioni')).toBe('/altro')
    expect(backFallback('/altro')).toBe('/')
  })
})
