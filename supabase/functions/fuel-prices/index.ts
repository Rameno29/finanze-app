import { handler, json } from '../_shared/access.ts'

// Prezzi carburante dei distributori italiani dagli open data MIMIT
// (https://www.mimit.gov.it — aggiornati ogni mattina). I due CSV (~8 MB totali)
// vengono scaricati e tenuti in cache in memoria per 6 ore; la funzione
// restituisce solo i distributori nel raggio richiesto, ordinati per prezzo.

const ANAGRAFICA_URL = 'https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv'
const PREZZI_URL = 'https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv'
const FUELS = new Set(['Benzina', 'Gasolio', 'GPL', 'Metano'])
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const MAX_AGE_DAYS = 30

interface FuelPrice {
  price: number
  is_self: boolean
  updated: string
}

interface Station {
  id: string
  brand: string
  name: string
  address: string
  comune: string
  lat: number
  lon: number
  prices: Record<string, FuelPrice>
}

let cache: { fetchedAt: number; stations: Station[] } | null = null

/** "09/07/2026 21:00:15" -> ISO, oppure null */
function parseItalianDate(raw: string): string | null {
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, dd, mm, yyyy, h, m, s] = match
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(h), Number(m), Number(s)))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Distanza in km sulla sfera terrestre. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(25_000) })
  if (!res.ok) throw new Error(`MIMIT ${res.status}`)
  return res.text()
}

/** Scarica e unisce anagrafica + prezzi. I file hanno una riga "Estrazione del ..." e poi l'header. */
async function loadStations(): Promise<Station[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.stations

  const [anagrafica, prezzi] = await Promise.all([fetchText(ANAGRAFICA_URL), fetchText(PREZZI_URL)])

  const byId = new Map<string, Station>()
  for (const line of anagrafica.split(/\r?\n/).slice(2)) {
    const cells = line.split('|')
    if (cells.length < 10) continue
    const lat = Number(cells[8])
    const lon = Number(cells[9])
    // Coordinate plausibili per l'Italia; scarta righe corrotte.
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 35 || lat > 48 || lon < 6 || lon > 19) continue
    byId.set(cells[0], {
      id: cells[0],
      brand: cells[2].trim(),
      name: cells[4].trim(),
      address: cells[5].trim().replace(/\s+/g, ' '),
      comune: cells[6].trim(),
      lat,
      lon,
      prices: {},
    })
  }

  const minUpdated = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  for (const line of prezzi.split(/\r?\n/).slice(2)) {
    const cells = line.split('|')
    if (cells.length < 5) continue
    const station = byId.get(cells[0])
    if (!station) continue
    const fuel = cells[1].trim()
    if (!FUELS.has(fuel)) continue
    const price = Number(cells[2])
    if (!Number.isFinite(price) || price <= 0 || price > 5) continue
    const updated = parseItalianDate(cells[4].trim())
    if (!updated || new Date(updated).getTime() < minUpdated) continue
    const current = station.prices[fuel]
    // A parità di carburante tiene il prezzo più basso (di solito il self service).
    if (!current || price < current.price) {
      station.prices[fuel] = { price, is_self: cells[3].trim() === '1', updated }
    }
  }

  const stations = Array.from(byId.values()).filter((s) => Object.keys(s.prices).length > 0)
  cache = { fetchedAt: Date.now(), stations }
  return stations
}

export const serve = handler(async ({ body, req }) => {
  const lat = Number(body.lat)
  const lon = Number(body.lon)
  const fuel = typeof body.fuel === 'string' ? body.fuel : 'Benzina'
  const radius = Math.min(Math.max(Number(body.radius_km) || 5, 1), 30)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 35 || lat > 48 || lon < 6 || lon > 19) {
    return json(req, { error: 'Posizione non valida (deve essere in Italia)' }, 400)
  }
  if (!FUELS.has(fuel)) return json(req, { error: 'Carburante non valido' }, 400)

  try {
    const stations = await loadStations()
    const results = stations
      .filter((s) => s.prices[fuel])
      .map((s) => ({
        id: s.id,
        brand: s.brand,
        name: s.name,
        address: s.address,
        comune: s.comune,
        lat: s.lat,
        lon: s.lon,
        distance_km: Number(haversineKm(lat, lon, s.lat, s.lon).toFixed(2)),
        price: s.prices[fuel].price,
        is_self: s.prices[fuel].is_self,
        updated: s.prices[fuel].updated,
      }))
      .filter((s) => s.distance_km <= radius)
      .sort((a, b) => a.price - b.price || a.distance_km - b.distance_km)
      .slice(0, 60)
    return json(req, { fuel, radius_km: radius, stations: results, source: 'MIMIT' })
  } catch {
    return json(req, { error: 'Servizio prezzi carburante non disponibile, riprova tra poco.' }, 502)
  }
}, { bucket: 'fuel-prices', bodyLimit: 4096 })
if (import.meta.main) Deno.serve(serve)
