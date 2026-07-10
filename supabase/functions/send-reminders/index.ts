import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const APP_ORIGIN = 'https://rameno29.github.io'
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

function originAllowed(req: Request): boolean {
  const origin = req.headers.get('Origin')
  return !origin || origin === APP_ORIGIN || LOCAL_ORIGIN.test(origin)
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function romeNow(): [string, string] {
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
  const [date, time] = s.split(' ')
  return [date, time]
}

interface Sub {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

Deno.serve(async (req: Request) => {
  if (!originAllowed(req)) return json({ error: 'origin_not_allowed' }, 403)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > 4096) return json({ error: 'payload_too_large' }, 413)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: secretRows } = await admin
    .from('app_secrets')
    .select('name, value')
    .in('name', ['CRON_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'])
  const secrets = new Map((secretRows ?? []).map((r: { name: string; value: string }) => [r.name, r.value]))

  const vapidPublic = secrets.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = secrets.get('VAPID_PRIVATE_KEY')
  if (!vapidPublic || !vapidPrivate) return json({ error: 'vapid_mancante' }, 500)
  webpush.setVapidDetails('mailto:bogdanstafie1996@gmail.com', vapidPublic, vapidPrivate)

  const body = await req.json().catch(() => ({}))

  // Invia una notifica cifrata, restituisce diagnostica leggibile
  async function push(sub: Sub, payload: string): Promise<{ ok: boolean; status?: number; error?: string }> {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      return { ok: true }
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('id', sub.id)
      }
      return { ok: false, status, error: (e as Error).message?.slice(0, 200) }
    }
  }

  // --- Modalità "notifica di prova": richiede il JWT dell'utente ---
  if (body?.test === true) {
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401)

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userData.user.id)
    if (!subs || subs.length === 0) return json({ error: 'nessuna_sottoscrizione' }, 400)

    const payload = JSON.stringify({
      title: 'AJE · notifica di prova',
      body: 'Perfetto! Le notifiche funzionano 🎉',
      url: '/finanze-app/agenda',
    })
    const results = await Promise.all((subs as Sub[]).map((s) => push(s, payload)))
    return json({ mode: 'test', sent: results.filter((r) => r.ok).length, results })
  }

  // --- Modalità cron: protetta dal segreto ---
  if (!secrets.get('CRON_SECRET') || req.headers.get('x-cron-secret') !== secrets.get('CRON_SECRET')) {
    return json({ error: 'unauthorized' }, 401)
  }

  const { data: subs } = await admin.from('push_subscriptions').select('*')
  if (!subs || subs.length === 0) return json({ due: 0, sent: 0, note: 'nessuna sottoscrizione' })

  const [today, hhmm] = romeNow()
  const userIds = [...new Set((subs as Sub[]).map((s) => s.user_id))]

  const { data: tasks } = await admin
    .from('tasks')
    .select('id, user_id, title, due_date, due_time')
    .eq('done', false)
    .eq('notified', false)
    .in('user_id', userIds)
    .not('due_date', 'is', null)
    .lte('due_date', today)

  const due = (tasks ?? []).filter(
    (t: { due_date: string; due_time: string | null }) =>
      t.due_date < today || (t.due_time ? t.due_time.slice(0, 5) <= hhmm : hhmm >= '09:00'),
  )

  let sent = 0
  const errors: Array<{ status?: number; error?: string }> = []
  for (const t of due) {
    const payload = JSON.stringify({
      title: 'Promemoria AJE',
      body: t.title + (t.due_time ? ` · ore ${t.due_time.slice(0, 5)}` : ''),
      url: '/finanze-app/agenda',
    })
    const targets = (subs as Sub[]).filter((x) => x.user_id === t.user_id)
    const results = await Promise.all(targets.map((s) => push(s, payload)))
    const anyOk = results.some((r) => r.ok)
    sent += results.filter((r) => r.ok).length
    for (const r of results) if (!r.ok) errors.push({ status: r.status, error: r.error })
    // Marca notificato solo se almeno un invio è riuscito (altrimenti riprova al prossimo giro)
    if (anyOk) {
      await admin
        .from('tasks')
        .update({ notified: true })
        .eq('id', t.id)
        .eq('user_id', t.user_id)
    }
  }

  return json({ due: due.length, sent, errors })
})
