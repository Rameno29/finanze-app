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

const GEMINI_MODEL = 'gemini-2.5-flash'

const PAYSLIP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    period_year: { type: 'INTEGER', description: 'Anno del periodo retributivo' },
    period_month: { type: 'INTEGER', description: 'Mese del periodo retributivo (1-12)' },
    net_eur: { type: 'NUMBER', description: 'Netto a pagare in euro' },
    gross_eur: { type: 'NUMBER', description: 'Retribuzione lorda totale in euro' },
    irpef_eur: { type: 'NUMBER', description: 'Totale trattenute IRPEF in euro' },
    inps_eur: { type: 'NUMBER', description: 'Contributi INPS a carico del dipendente in euro' },
    other_deductions_eur: { type: 'NUMBER', description: 'Altre trattenute in euro' },
    vacation_days: { type: 'NUMBER', description: 'Ferie residue in giorni' },
    leave_hours: { type: 'NUMBER', description: 'Permessi residui in ore' },
    employer: { type: 'STRING', description: 'Nome del datore di lavoro' },
    notes: { type: 'STRING', description: 'Note o anomalie riscontrate' },
  },
  required: ['period_year', 'period_month', 'net_eur'],
}

const RECEIPT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    total_eur: { type: 'NUMBER', description: 'Totale pagato in euro' },
    date: { type: 'STRING', description: 'Data dello scontrino in formato YYYY-MM-DD' },
    merchant: { type: 'STRING', description: 'Nome del negozio/esercente' },
    category: {
      type: 'STRING',
      description:
        'Categoria di spesa più adatta tra: Spesa, Ristoranti, Trasporti, Salute, Abbigliamento, Svago, Bollette, Viaggi, Altro',
    },
    notes: { type: 'STRING', description: 'Dettagli utili (es. articoli principali)' },
  },
  required: ['total_eur'],
}

const GENERATE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Titolo del documento' },
    sections: {
      type: 'ARRAY',
      description: 'Le sezioni del documento, in ordine',
      items: {
        type: 'OBJECT',
        properties: {
          heading: { type: 'STRING', description: 'Titolo della sezione' },
          body: { type: 'STRING', description: 'Testo della sezione (paragrafi separati da riga vuota; per gli elenchi usa "- " a inizio riga)' },
        },
        required: ['heading', 'body'],
      },
    },
  },
  required: ['title', 'sections'],
}

const PARSE_TX_SCHEMA = {
  type: 'OBJECT',
  properties: {
    amount_eur: { type: 'NUMBER', description: "Importo in euro (sempre positivo)" },
    kind: { type: 'STRING', description: "'expense' per una spesa, 'income' per un'entrata" },
    category: { type: 'STRING', description: 'Il nome ESATTO di una delle categorie fornite, oppure vuoto' },
    date: { type: 'STRING', description: 'Data in formato YYYY-MM-DD (risolvi "ieri", "lunedì scorso" ecc. rispetto alla data odierna fornita)' },
    description: { type: 'STRING', description: 'Breve descrizione del movimento (es. "Pizza con amici")' },
  },
  required: ['amount_eur', 'kind'],
}

const DOCUMENT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Titolo breve che identifica il documento' },
    summary: { type: 'STRING', description: 'Riassunto del documento in 2-3 frasi' },
    key_points: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'I punti chiave del documento (max 6)',
    },
    explanation: {
      type: 'STRING',
      description:
        'Spiegazione del documento in linguaggio semplice, come la faresti a un amico. Includi cosa deve fare o sapere il lettore.',
    },
  },
  required: ['title', 'summary', 'explanation'],
}

interface GeminiResult {
  text: string
  sources: Array<{ title: string; url: string }>
}

async function callGeminiFull(
  apiKey: string,
  parts: unknown[],
  schema: unknown | null,
  useSearch = false,
): Promise<GeminiResult> {
  const body: Record<string, unknown> = { contents: [{ parts }] }
  if (schema) {
    body.generationConfig = { responseMimeType: 'application/json', responseSchema: schema }
  }
  if (useSearch) {
    body.tools = [{ google_search: {} }]
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const errText = await res.text()
    console.error('Gemini API error:', res.status, errText.slice(0, 500))
    throw new Error(`gemini_${res.status}`)
  }
  const data = await res.json()
  const candidate = data.candidates?.[0]
  const text = (candidate?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? '')
    .join('')
  if (!text) throw new Error('gemini_empty')
  const sources = ((candidate?.groundingMetadata?.groundingChunks ?? []) as Array<{
    web?: { uri?: string; title?: string }
  }>)
    .filter((c) => c.web?.uri)
    .map((c) => ({ title: c.web!.title ?? c.web!.uri!, url: c.web!.uri! }))
  return { text, sources }
}

async function callGemini(
  apiKey: string,
  parts: unknown[],
  schema: unknown | null,
): Promise<string> {
  return (await callGeminiFull(apiKey, parts, schema)).text
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  // Identifica l'utente dal JWT
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401)
  const userId = userData.user.id

  // Chiave Gemini: da env oppure dalla tabella protetta app_secrets
  let apiKey = Deno.env.get('GEMINI_API_KEY') ?? ''
  if (!apiKey) {
    const { data: secret } = await admin
      .from('app_secrets')
      .select('value')
      .eq('name', 'GEMINI_API_KEY')
      .maybeSingle()
    apiKey = secret?.value ?? ''
  }
  if (!apiKey) return json({ error: 'missing_api_key' }, 400)

  const { mode, document_id, video_url, prompt, query, question, text } = await req.json().catch(() => ({}))

  try {
    // ---- Assistente finanziario: risponde guardando i dati dell'utente ----
    if (mode === 'assistant') {
      if (typeof question !== 'string' || !question.trim()) return json({ error: 'domanda mancante' }, 400)
      if (question.length > 500) return json({ error: 'Domanda troppo lunga (max 500 caratteri)' }, 400)

      const yearAgo = new Date()
      yearAgo.setFullYear(yearAgo.getFullYear() - 1)
      const fromISO = yearAgo.toISOString().slice(0, 10)

      const [txRes, catRes, budgetRes, goalRes] = await Promise.all([
        admin
          .from('transactions')
          .select('date, amount_cents, kind, category_id, description')
          .eq('user_id', userId)
          .gte('date', fromISO)
          .order('date', { ascending: false })
          .limit(1500),
        admin.from('categories').select('id, name, kind').eq('user_id', userId),
        admin.from('budgets').select('category_id, monthly_cents').eq('user_id', userId),
        admin.from('goals').select('name, target_cents, saved_cents, deadline').eq('user_id', userId),
      ])

      const catName = new Map(
        ((catRes.data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
      )
      const txLines = ((txRes.data ?? []) as Array<{
        date: string
        amount_cents: number
        kind: string
        category_id: string | null
        description: string
      }>)
        .map(
          (t) =>
            `${t.date};${t.kind === 'income' ? '+' : '-'}${(t.amount_cents / 100).toFixed(2)};${
              t.category_id ? (catName.get(t.category_id) ?? '') : ''
            };${(t.description ?? '').slice(0, 40)}`,
        )
        .join('\n')
      const budgetLines = ((budgetRes.data ?? []) as Array<{ category_id: string; monthly_cents: number }>)
        .map((b) => `${catName.get(b.category_id) ?? '?'}: ${(b.monthly_cents / 100).toFixed(2)} EUR/mese`)
        .join('\n')
      const goalLines = ((goalRes.data ?? []) as Array<{
        name: string
        target_cents: number
        saved_cents: number
        deadline: string | null
      }>)
        .map(
          (g) =>
            `${g.name}: ${(g.saved_cents / 100).toFixed(2)} su ${(g.target_cents / 100).toFixed(2)} EUR${
              g.deadline ? ` entro ${g.deadline}` : ''
            }`,
        )
        .join('\n')

      const result = await callGeminiFull(
        apiKey,
        [
          {
            text:
              `Sei l'assistente finanziario personale dell'app AJE. Oggi è ${new Date().toISOString().slice(0, 10)}.\n` +
              `Movimenti degli ultimi 12 mesi dell'utente (formato: data;importo;categoria;descrizione — importi con segno, in EUR):\n${txLines || '(nessun movimento)'}\n\n` +
              `Budget mensili:\n${budgetLines || '(nessuno)'}\n\n` +
              `Obiettivi di risparmio:\n${goalLines || '(nessuno)'}\n\n` +
              `Rispondi in ITALIANO alla domanda dell'utente basandoti SOLO su questi dati (fai i calcoli con precisione). ` +
              `Sii conciso e concreto; usa elenchi puntati ("- " a inizio riga) se utile; importi in euro con la virgola. ` +
              `Se la domanda non riguarda le sue finanze, rispondi comunque brevemente ma riportala ai suoi dati quando possibile.\n\n` +
              `Domanda: ${question.trim()}`,
          },
        ],
        null,
      )
      return json({ answer: result.text })
    }

    // ---- Interpreta una frase in linguaggio naturale come movimento ----
    if (mode === 'parse_transaction') {
      if (typeof text !== 'string' || !text.trim()) return json({ error: 'testo mancante' }, 400)
      if (text.length > 300) return json({ error: 'Frase troppo lunga (max 300 caratteri)' }, 400)

      const { data: cats } = await admin
        .from('categories')
        .select('name, kind')
        .eq('user_id', userId)
      const catList = ((cats ?? []) as Array<{ name: string; kind: string }>)
        .map((c) => `${c.name} (${c.kind === 'income' ? 'entrata' : 'uscita'})`)
        .join(', ')

      const parsed = await callGemini(
        apiKey,
        [
          {
            text:
              `Oggi è ${new Date().toISOString().slice(0, 10)}. Interpreta questa frase in italiano come un movimento finanziario ` +
              `(spesa o entrata): "${text.trim()}".\n` +
              `Categorie disponibili dell'utente: ${catList || '(nessuna)'}. Scegli la più adatta usando il nome ESATTO, oppure lascia vuoto.`,
          },
        ],
        PARSE_TX_SCHEMA,
      )
      const input = JSON.parse(parsed)
      return json({
        amount_cents: eurToCents(input.amount_eur),
        kind: input.kind === 'income' ? 'income' : 'expense',
        category_name: typeof input.category === 'string' ? input.category : null,
        date:
          typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null,
        description: typeof input.description === 'string' ? input.description : '',
      })
    }

    // ---- Ricerca web con AI ----
    if (mode === 'websearch') {
      if (typeof query !== 'string' || !query.trim()) return json({ error: 'query mancante' }, 400)
      if (query.length > 500) return json({ error: 'Domanda troppo lunga (max 500 caratteri)' }, 400)
      const result = await callGeminiFull(
        apiKey,
        [
          {
            text:
              `Cerca sul web e rispondi in ITALIANO a questa domanda in modo chiaro e completo ma conciso. ` +
              `Se utile usa elenchi puntati (righe che iniziano con "- "). Domanda: ${query.trim()}`,
          },
        ],
        null,
        true,
      )
      return json({ answer: result.text, sources: result.sources.slice(0, 6) })
    }

    // ---- Generazione documento (da testo e/o video YouTube) ----
    if (mode === 'generate') {
      if (typeof prompt !== 'string' || !prompt.trim()) return json({ error: 'prompt mancante' }, 400)
      if (prompt.length > 2000) return json({ error: 'Richiesta troppo lunga (max 2000 caratteri)' }, 400)
      const parts: unknown[] = []
      if (
        typeof video_url === 'string' &&
        video_url.length <= 200 &&
        /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(video_url)
      ) {
        parts.push({ file_data: { file_uri: video_url } })
      }
      parts.push({
        text:
          'Crea un documento in ITALIANO, professionale e ben organizzato, in base a questa richiesta' +
          (parts.length > 0 ? ' e al contenuto del video allegato' : '') +
          `: ${prompt.trim()}\n\n` +
          'Suddividi il contenuto in sezioni con titoli chiari. Sii completo ma senza riempitivi.',
      })
      const text2 = await callGemini(apiKey, parts, GENERATE_SCHEMA)
      return json(JSON.parse(text2))
    }

    // ---- Riassunto video YouTube (nessun file) ----
    if (mode === 'youtube') {
      if (
        typeof video_url !== 'string' ||
        video_url.length > 200 ||
        !/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(video_url)
      ) {
        return json({ error: 'video_url non valido' }, 400)
      }
      const summary = await callGemini(
        apiKey,
        [
          { file_data: { file_uri: video_url } },
          {
            text:
              'Guarda questo video e scrivi un riassunto in ITALIANO, chiaro e ben organizzato. ' +
              'Struttura: una frase iniziale su di cosa parla il video, poi i punti principali come elenco puntato (usa "- " a inizio riga), ' +
              'e infine eventuali conclusioni o consigli pratici. Sii fedele al contenuto, non inventare.',
          },
        ],
        null,
      )
      return json({ summary })
    }

    // ---- Modalità con documento ----
    if (!document_id) return json({ error: 'document_id mancante' }, 400)
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

    const name = doc.file_name.toLowerCase()
    const mimeType = name.endsWith('.pdf')
      ? 'application/pdf'
      : name.endsWith('.png')
        ? 'image/png'
        : name.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg'
    const fileBlock = { inline_data: { mime_type: mimeType, data: toBase64(bytes) } }

    if (mode === 'payslip') {
      const out = await callGemini(
        apiKey,
        [
          fileBlock,
          {
            text:
              'Questa è una busta paga italiana. Estrai i dati richiesti dal cedolino. ' +
              'Il "netto" è il NETTO A PAGARE / netto in busta. Se un valore non è leggibile, omettilo.',
          },
        ],
        PAYSLIP_SCHEMA,
      )
      const input = JSON.parse(out)
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
    }

    if (mode === 'receipt') {
      const out = await callGemini(
        apiKey,
        [
          fileBlock,
          {
            text:
              'Questo è uno scontrino o una ricevuta italiana. Estrai il totale pagato, la data, ' +
              'il nome dell\'esercente e la categoria di spesa più adatta.',
          },
        ],
        RECEIPT_SCHEMA,
      )
      const input = JSON.parse(out)
      return json({
        total_cents: eurToCents(input.total_eur),
        date: typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null,
        merchant: typeof input.merchant === 'string' ? input.merchant : null,
        category_hint: typeof input.category === 'string' ? input.category : null,
        notes: typeof input.notes === 'string' ? input.notes : null,
      })
    }

    if (mode === 'document') {
      const out = await callGemini(
        apiKey,
        [
          fileBlock,
          {
            text:
              'Analizza questo documento (può essere una lettera, un contratto, una bolletta, un referto, un modulo, ecc.). ' +
              'Rispondi in ITALIANO semplice e comprensibile a chiunque.',
          },
        ],
        DOCUMENT_SCHEMA,
      )
      const analysis = JSON.parse(out)
      await admin
        .from('documents')
        .update({ analysis, status: 'analizzato' })
        .eq('id', document_id)
      return json(analysis)
    }

    return json({ error: 'mode non valido' }, 400)
  } catch (e) {
    console.error('ai-analyze error:', e)
    if (document_id) {
      await admin.from('documents').update({ status: 'errore' }).eq('id', document_id)
    }
    return json({ error: "L'analisi AI non è riuscita, riprova tra poco." }, 502)
  }
})
