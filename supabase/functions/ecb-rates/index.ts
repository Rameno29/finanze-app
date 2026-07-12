import { createClient } from 'jsr:@supabase/supabase-js@2'

const APP_ORIGIN = 'https://rameno29.github.io'
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
const currencies = new Set([
  'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'SEK',
  'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY',
])

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
    headers: { ...cors(req), 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=3600' },
  })
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function csvRow(line: string): string[] {
  const fields: string[] = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++ } else quoted = !quoted
    } else if (char === ',' && !quoted) {
      fields.push(value)
      value = ''
    } else value += char
  }
  fields.push(value)
  return fields
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'Metodo non consentito' }, 405)
  const origin = req.headers.get('Origin')
  if (origin && origin !== APP_ORIGIN && !LOCAL_ORIGIN.test(origin)) return json(req, { error: 'Origine non consentita' }, 403)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(req, { error: 'Autenticazione richiesta' }, 401)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: authData, error: authError } = await authClient.auth.getUser()
  if (authError || !authData.user) return json(req, { error: 'Sessione non valida' }, 401)

  let body: { currency?: unknown; date?: unknown }
  try { body = await req.json() } catch { return json(req, { error: 'JSON non valido' }, 400) }
  const currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : ''
  if (!currencies.has(currency) || !validDate(body.date)) return json(req, { error: 'Valuta o data non valida' }, 400)

  const today = new Date().toISOString().slice(0, 10)
  const requestedDate = body.date > today ? today : body.date
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)
  const start = new Date(`${requestedDate}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - 10)
  const startPeriod = start.toISOString().slice(0, 10)
  const { data: cached } = await admin
    .from('exchange_rates')
    .select('observed_on, units_per_eur')
    .eq('currency_code', currency)
    .gte('observed_on', startPeriod)
    .lte('observed_on', requestedDate)
    .order('observed_on', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Un dato già presente è definitivo per la data storica; quello odierno viene aggiornato dopo un'ora.
  if (cached) {
    const units = Number(cached.units_per_eur)
    const rateToEur = Number((1 / units).toFixed(10))
    return json(req, {
      currency, requested_date: body.date, observed_on: cached.observed_on,
      units_per_eur: units, rate_to_eur: rateToEur, source: 'ECB',
    })
  }

  const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${currency}.EUR.SP00.A?startPeriod=${startPeriod}&endPeriod=${requestedDate}&format=csvdata&detail=dataonly`
  const response = await fetch(url, { headers: { Accept: 'text/csv' }, signal: AbortSignal.timeout(10_000) })
  if (!response.ok) return json(req, { error: 'Servizio BCE temporaneamente non disponibile' }, 502)
  const lines = (await response.text()).trim().split(/\r?\n/)
  if (lines.length < 2) return json(req, { error: 'Nessun cambio BCE disponibile per la data' }, 404)
  const headers = csvRow(lines[0])
  const dateIndex = headers.indexOf('TIME_PERIOD')
  const valueIndex = headers.indexOf('OBS_VALUE')
  if (dateIndex < 0 || valueIndex < 0) return json(req, { error: 'Formato BCE non riconosciuto' }, 502)
  const observations = lines.slice(1).map(csvRow)
    .map((row) => ({ observed_on: row[dateIndex], units_per_eur: Number(row[valueIndex]) }))
    .filter((row) => validDate(row.observed_on) && Number.isFinite(row.units_per_eur) && row.units_per_eur > 0)
    .sort((a, b) => b.observed_on.localeCompare(a.observed_on))
  const latest = observations[0]
  if (!latest) return json(req, { error: 'Nessun cambio BCE disponibile per la data' }, 404)

  const { error: cacheError } = await admin.from('exchange_rates').upsert({
    currency_code: currency,
    observed_on: latest.observed_on,
    units_per_eur: latest.units_per_eur,
    source: 'ECB',
    fetched_at: new Date().toISOString(),
  })
  if (cacheError) console.error('ECB cache:', cacheError.message)

  const rateToEur = Number((1 / latest.units_per_eur).toFixed(10))
  return json(req, {
    currency, requested_date: body.date, observed_on: latest.observed_on,
    units_per_eur: latest.units_per_eur, rate_to_eur: rateToEur, source: 'ECB',
  })
})
