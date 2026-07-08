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

function eurToCents(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

function isoDate(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

const COMMAND_SCHEMA = {
  type: 'OBJECT',
  properties: {
    action: {
      type: 'STRING',
      description:
        "L'azione richiesta, una tra: 'add_transaction' (registrare una spesa o un'entrata), " +
        "'add_task' (creare un promemoria/attività in agenda), 'add_goal' (creare un nuovo obiettivo di risparmio), " +
        "'contribute_goal' (aggiungere o togliere soldi a un obiettivo esistente), " +
        "'set_budget' (impostare il budget mensile di una categoria), " +
        "'answer' (non è un comando ma una domanda o una chiacchiera: non c'è nulla da eseguire)",
    },
    say: {
      type: 'STRING',
      description:
        "Breve frase in italiano che riassume l'azione che si sta per eseguire, es. " +
        "\"Registro un'uscita di 20,00 € in Ristoranti per oggi\". Vuota se action è 'answer'.",
    },
    amount_eur: { type: 'NUMBER', description: 'Importo in euro (sempre positivo)' },
    kind: { type: 'STRING', description: "Per add_transaction: 'expense' (spesa) o 'income' (entrata)" },
    category: { type: 'STRING', description: 'Nome ESATTO di una delle categorie fornite, oppure vuoto' },
    date: { type: 'STRING', description: 'Data YYYY-MM-DD (risolvi "ieri", "venerdì prossimo" ecc. rispetto a oggi)' },
    time: { type: 'STRING', description: 'Ora HH:MM per i promemoria, se indicata' },
    description: { type: 'STRING', description: 'Descrizione breve del movimento' },
    recurrence: { type: 'STRING', description: "Se ricorrente: 'mensile', 'settimanale' o 'annuale'; altrimenti vuoto" },
    title: { type: 'STRING', description: "Per add_task: il titolo dell'attività, es. 'Pagare il bollo'" },
    goal_name: { type: 'STRING', description: "Per add_goal/contribute_goal: il nome dell'obiettivo (per contribute usa il nome ESATTO tra quelli forniti)" },
    target_eur: { type: 'NUMBER', description: "Per add_goal: il traguardo in euro" },
    deadline: { type: 'STRING', description: 'Per add_goal: scadenza YYYY-MM-DD se indicata' },
    direction: { type: 'STRING', description: "Per contribute_goal: 'add' per aggiungere, 'remove' per togliere" },
  },
  required: ['action'],
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401)
  const userId = userData.user.id

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

  const { text } = await req.json().catch(() => ({}))
  if (typeof text !== 'string' || !text.trim()) return json({ error: 'testo mancante' }, 400)
  if (text.length > 300) return json({ error: 'Frase troppo lunga (max 300 caratteri)' }, 400)

  // Contesto leggero: categorie e obiettivi dell'utente per il matching dei nomi
  const [catRes, goalRes] = await Promise.all([
    admin.from('categories').select('name, kind').eq('user_id', userId),
    admin.from('goals').select('name').eq('user_id', userId),
  ])
  const catList = ((catRes.data ?? []) as Array<{ name: string; kind: string }>)
    .map((c) => `${c.name} (${c.kind === 'income' ? 'entrata' : 'uscita'})`)
    .join(', ')
  const goalList = ((goalRes.data ?? []) as Array<{ name: string }>).map((g) => g.name).join(', ')

  const prompt =
    `Sei l'interprete dei comandi vocali dell'app di finanze personali AJE. Oggi è ${new Date().toISOString().slice(0, 10)}.\n` +
    `Categorie dell'utente: ${catList || '(nessuna)'}.\n` +
    `Obiettivi di risparmio esistenti: ${goalList || '(nessuno)'}.\n\n` +
    `Interpreta questa frase dell'utente e determina l'azione: "${text.trim()}"\n\n` +
    `Esempi: "ho speso 20 euro di pizza" → add_transaction uscita; "mi sono arrivati 500 euro" → add_transaction entrata; ` +
    `"ricordami di pagare il bollo venerdì alle 18" → add_task; "voglio mettere da parte 1000 euro per Natale" → add_goal; ` +
    `"metti 50 euro nelle vacanze" → contribute_goal; "imposta 300 euro di budget per la spesa" → set_budget; ` +
    `"quanto ho speso a giugno?" → answer.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: COMMAND_SCHEMA },
      }),
    },
  )
  if (!res.ok) {
    console.error('Gemini error', res.status, (await res.text()).slice(0, 300))
    return json({ error: "Interpretazione non riuscita, riprova." }, 502)
  }
  const data = await res.json()
  const raw = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? '')
    .join('')
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return json({ error: 'Interpretazione non riuscita, riprova.' }, 502)
  }

  const action = String(parsed.action ?? 'answer')
  const say = typeof parsed.say === 'string' ? parsed.say : ''

  // Normalizzazione per azione: il client riceve dati già pronti (centesimi, date valide)
  if (action === 'add_transaction') {
    const amount = eurToCents(parsed.amount_eur)
    if (!amount) return json({ action: 'answer' })
    return json({
      action,
      say,
      data: {
        amount_cents: amount,
        kind: parsed.kind === 'income' ? 'income' : 'expense',
        category_name: typeof parsed.category === 'string' ? parsed.category : null,
        date: isoDate(parsed.date),
        description: typeof parsed.description === 'string' ? parsed.description : '',
        recurrence: ['mensile', 'settimanale', 'annuale'].includes(String(parsed.recurrence))
          ? String(parsed.recurrence)
          : null,
      },
    })
  }

  if (action === 'add_task') {
    const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : null
    if (!title) return json({ action: 'answer' })
    return json({
      action,
      say,
      data: {
        title,
        due_date: isoDate(parsed.date),
        due_time:
          typeof parsed.time === 'string' && /^\d{2}:\d{2}$/.test(parsed.time) ? parsed.time : null,
      },
    })
  }

  if (action === 'add_goal') {
    const target = eurToCents(parsed.target_eur)
    const name = typeof parsed.goal_name === 'string' && parsed.goal_name.trim() ? parsed.goal_name.trim() : null
    if (!target || !name) return json({ action: 'answer' })
    return json({ action, say, data: { name, target_cents: target, deadline: isoDate(parsed.deadline) } })
  }

  if (action === 'contribute_goal') {
    const amount = eurToCents(parsed.amount_eur)
    const name = typeof parsed.goal_name === 'string' && parsed.goal_name.trim() ? parsed.goal_name.trim() : null
    if (!amount || !name) return json({ action: 'answer' })
    return json({
      action,
      say,
      data: { goal_name: name, amount_cents: amount, direction: parsed.direction === 'remove' ? 'remove' : 'add' },
    })
  }

  if (action === 'set_budget') {
    const amount = eurToCents(parsed.amount_eur)
    const category = typeof parsed.category === 'string' && parsed.category.trim() ? parsed.category.trim() : null
    if (!amount || !category) return json({ action: 'answer' })
    return json({ action, say, data: { category_name: category, monthly_cents: amount } })
  }

  return json({ action: 'answer' })
})
