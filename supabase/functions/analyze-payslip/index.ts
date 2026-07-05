import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function eurToCents(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

const EXTRACTION_TOOL = {
  name: 'salva_busta_paga',
  description: 'Salva i dati estratti da una busta paga italiana',
  input_schema: {
    type: 'object',
    properties: {
      period_year: { type: 'integer', description: 'Anno del periodo retributivo' },
      period_month: { type: 'integer', description: 'Mese del periodo retributivo (1-12)' },
      net_eur: { type: 'number', description: 'Netto in busta (netto a pagare) in euro' },
      gross_eur: { type: 'number', description: 'Retribuzione lorda totale in euro' },
      irpef_eur: { type: 'number', description: 'Totale trattenute IRPEF in euro' },
      inps_eur: { type: 'number', description: 'Contributi INPS a carico del dipendente in euro' },
      other_deductions_eur: { type: 'number', description: 'Altre trattenute in euro' },
      vacation_days: { type: 'number', description: 'Ferie residue in giorni' },
      leave_hours: { type: 'number', description: 'Permessi (ROL/ex festività) residui in ore' },
      employer: { type: 'string', description: 'Nome del datore di lavoro' },
      notes: { type: 'string', description: 'Eventuali note o anomalie riscontrate' },
    },
    required: ['period_year', 'period_month', 'net_eur'],
  },
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'missing_api_key' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Identifica l'utente dal JWT della richiesta
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401)
  const userId = userData.user.id

  const { document_id } = await req.json().catch(() => ({}))
  if (!document_id) return json({ error: 'document_id mancante' }, 400)

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: doc, error: docErr } = await admin
    .from('documents')
    .select('*')
    .eq('id', document_id)
    .eq('user_id', userId)
    .single()
  if (docErr || !doc) return json({ error: 'Documento non trovato' }, 404)

  const { data: file, error: dlErr } = await admin.storage
    .from('documents')
    .download(doc.storage_path)
  if (dlErr || !file) return json({ error: 'Download del file non riuscito' }, 500)

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.length > 20 * 1024 * 1024) return json({ error: 'File troppo grande (max 20 MB)' }, 400)
  const base64 = toBase64(bytes)

  const name = doc.file_name.toLowerCase()
  const isPdf = name.endsWith('.pdf')
  const mediaType = isPdf ? 'application/pdf' : name.endsWith('.png') ? 'image/png' : 'image/jpeg'
  const fileBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'salva_busta_paga' },
      messages: [
        {
          role: 'user',
          content: [
            fileBlock,
            {
              type: 'text',
              text:
                'Questa è una busta paga italiana. Estrai i dati richiesti dal cedolino. ' +
                'Gli importi sono in euro (usa il punto come separatore decimale). ' +
                'Il "netto" è il NETTO A PAGARE / netto in busta. ' +
                'Se un valore non è presente o non è leggibile, omettilo.',
            },
          ],
        },
      ],
    }),
  })

  if (!anthropicRes.ok) {
    const errBody = await anthropicRes.text()
    console.error('Anthropic API error:', anthropicRes.status, errBody)
    await admin.from('documents').update({ status: 'errore' }).eq('id', document_id)
    if (anthropicRes.status === 401) return json({ error: 'Chiave API Anthropic non valida' }, 400)
    return json({ error: "L'analisi AI non è riuscita, riprova." }, 502)
  }

  const result = await anthropicRes.json()
  const toolUse = result.content?.find((b: { type: string }) => b.type === 'tool_use')
  if (!toolUse?.input) {
    await admin.from('documents').update({ status: 'errore' }).eq('id', document_id)
    return json({ error: 'Nessun dato estratto dal documento' }, 422)
  }
  const input = toolUse.input as Record<string, unknown>

  const deductions: Record<string, number> = {}
  const irpef = eurToCents(input.irpef_eur)
  const inps = eurToCents(input.inps_eur)
  const other = eurToCents(input.other_deductions_eur)
  if (irpef) deductions.irpef = irpef
  if (inps) deductions.inps = inps
  if (other) deductions.altre = other

  const month = Number(input.period_month)
  const year = Number(input.period_year)

  return json({
    period_year: year >= 2000 && year <= 2100 ? year : null,
    period_month: month >= 1 && month <= 12 ? month : null,
    net_cents: eurToCents(input.net_eur),
    gross_cents: eurToCents(input.gross_eur),
    deductions,
    vacation_days: Number.isFinite(Number(input.vacation_days)) ? Number(input.vacation_days) : null,
    leave_hours: Number.isFinite(Number(input.leave_hours)) ? Number(input.leave_hours) : null,
    employer: typeof input.employer === 'string' ? input.employer : null,
    notes: typeof input.notes === 'string' ? input.notes : null,
  })
})
