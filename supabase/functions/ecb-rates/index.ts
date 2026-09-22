import { handler, json } from '../_shared/access.ts'

const currencies = new Set([
  'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'SEK',
  'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY',
])

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

export const serve = handler(async ({ admin, body, req }) => {
  const currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : ''
  if (!currencies.has(currency) || !validDate(body.date)) return json(req, { error: 'Valuta o data non valida' }, 400)

  const today = new Date().toISOString().slice(0, 10)
  const requestedDate = body.date > today ? today : body.date
  const start = new Date(`${requestedDate}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - 10)
  const startPeriod = start.toISOString().slice(0, 10)
  const { data: cached } = await admin
    .from('exchange_rates')
    .select('observed_on, units_per_eur, fetched_at')
    .eq('currency_code', currency)
    .gte('observed_on', startPeriod)
    .lte('observed_on', requestedDate)
    .order('observed_on', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Un dato già presente è definitivo per la data storica; quello odierno viene aggiornato dopo un'ora.
  if (cached && ((cached.observed_on === requestedDate && requestedDate < today) || new Date(cached.fetched_at).getTime() > Date.now() - 3_600_000)) {
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
  if (cacheError) return json(req, { error: 'service_unavailable' }, 503)

  const rateToEur = Number((1 / latest.units_per_eur).toFixed(10))
  return json(req, {
    currency, requested_date: body.date, observed_on: latest.observed_on,
    units_per_eur: latest.units_per_eur, rate_to_eur: rateToEur, source: 'ECB',
  })
}, { bucket: 'ecb-rates', bodyLimit: 4096 })
if (import.meta.main) Deno.serve(serve)
