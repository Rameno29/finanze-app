import { createClient } from 'jsr:@supabase/supabase-js@2'

// Prezzi carburante dei distributori italiani dagli open data MIMIT
// (https://www.mimit.gov.it — aggiornati ogni mattina). I due CSV (~8 MB totali)
// vengono scaricati e tenuti in cache in memoria per 6 ore; la funzione
// restituisce solo i distributori nel raggio richiesto, ordinati per prezzo.

const APP_ORIGIN = 'https://rameno29.github.io'
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
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
const rateBuckets = new Map<string, { start: number; count: number }>()

function cors(req: Request) {
  const origin = req.headers.get('Origin')
  return {
    'Access-Control-Allow-Origin': origin === APP_ORIGIN || (origin && LOCAL_ORIGIN.test(origin)) ? origin : APP_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=600' },
  })
}

function rateLimited(userId: string, max = 20): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(userId)
  if (!bucket || now - bucket.start >= 60_000) {
    rateBuckets.set(userId, { start: now, count: 1 })
    return false
  }
  bucket.count += 1
  return bucket.count > max
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'Metodo non consentito' }, 405)
  const origin = req.headers.get('Origin')
  if (origin && origin !== APP_ORIGIN && !LOCAL_ORIGIN.test(origin)) return json(req, { error: 'Origine non consentita' }, 403)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(req, { error: 'Autenticazione richiesta' }, 401)
  const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: authData, error: authError } = await authClient.auth.getUser()
  if (authError || !authData.user) return json(req, { error: 'Sessione non valida' }, 401)
  if (rateLimited(authData.user.id)) return json(req, { error: 'Troppe richieste, attendi un minuto' }, 429)

  let body: { lat?: unknown; lon?: unknown; radius_km?: unknown; fuel?: unknown }
  try { body = await req.json() } catch { return json(req, { error: 'JSON non valido' }, 400) }
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
  } catch (e) {
    console.error('fuel-prices error:', e)
    return json(req, { error: 'Servizio prezzi carburante non disponibile, riprova tra poco.' }, 502)
  }
})
