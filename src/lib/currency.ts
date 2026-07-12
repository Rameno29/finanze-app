import { supabase } from './supabase'

export const SUPPORTED_CURRENCIES = [
  'EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY',
  'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY',
] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

export interface ExchangeRate {
  currency: CurrencyCode
  requested_date: string
  observed_on: string
  units_per_eur: number
  rate_to_eur: number
  source: 'ECB'
}

const CACHE_KEY = 'aje-ecb-rates-v1'

function readCache(): Record<string, ExchangeRate> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, ExchangeRate>
  } catch {
    return {}
  }
}

function writeCache(cache: Record<string, ExchangeRate>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // La cache dei cambi è un'ottimizzazione: l'app continua a funzionare senza storage locale.
  }
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}

export function formatCurrencyCents(cents: number, currency: string): string {
  const safeCurrency = isCurrencyCode(currency) ? currency : 'EUR'
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: safeCurrency }).format(cents / 100)
}

export function convertToEurCents(originalCents: number, rateToEur: number): number {
  if (!Number.isSafeInteger(originalCents) || originalCents <= 0) throw new Error('Importo non valido')
  if (!Number.isFinite(rateToEur) || rateToEur <= 0) throw new Error('Cambio non valido')
  const converted = Math.round(originalCents * rateToEur)
  if (!Number.isSafeInteger(converted) || converted <= 0) throw new Error('Controvalore non valido')
  return converted
}

/** Recupera il cambio BCE del giorno o dell'ultimo giorno lavorativo precedente. */
export async function getExchangeRate(currency: CurrencyCode, date: string): Promise<ExchangeRate> {
  if (currency === 'EUR') {
    return {
      currency,
      requested_date: date,
      observed_on: date,
      units_per_eur: 1,
      rate_to_eur: 1,
      source: 'ECB',
    }
  }

  const cache = readCache()
  const key = `${currency}:${date}`
  const exact = cache[key]
  if (!navigator.onLine && exact) return exact

  if (navigator.onLine) {
    const { data, error } = await supabase.functions.invoke('ecb-rates', {
      body: { currency, date },
    })
    if (!error && data) {
      const rate = data as ExchangeRate
      if (
        rate.currency === currency &&
        Number.isFinite(rate.rate_to_eur) && rate.rate_to_eur > 0 &&
        /^\d{4}-\d{2}-\d{2}$/.test(rate.observed_on)
      ) {
        cache[key] = rate
        writeCache(cache)
        return rate
      }
    }
    if (exact) return exact
    if (error) throw error
  }

  if (exact) return exact
  throw new Error('Cambio BCE non disponibile offline per questa data')
}
