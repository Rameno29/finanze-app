import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Data e ora correnti in Italia: ['YYYY-MM-DD', 'HH:mm'] */
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

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: secretRows } = await admin
    .from('app_secrets')
    .select('name, value')
    .in('name', ['CRON_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'])
  const secrets = new Map((secretRows ?? []).map((r: { name: string; value: string }) => [r.name, r.value]))

  if (!secrets.get('CRON_SECRET') || req.headers.get('x-cron-secret') !== secrets.get('CRON_SECRET')) {
    return json({ error: 'unauthorized' }, 401)
  }

  webpush.setVapidDetails(
    'mailto:bogdanstafie1996@gmail.com',
    secrets.get('VAPID_PUBLIC_KEY')!,
    secrets.get('VAPID_PRIVATE_KEY')!,
  )

  const { data: subs } = await admin.from('push_subscriptions').select('*')
  if (!subs || subs.length === 0) return json({ due: 0, sent: 0, note: 'nessuna sottoscrizione' })

  const [today, hhmm] = romeNow()
  const userIds = [...new Set(subs.map((s: { user_id: string }) => s.user_id))]

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
  for (const t of due) {
    const payload = JSON.stringify({
      title: 'Promemoria AJE',
      body: t.title + (t.due_time ? ` · ore ${t.due_time.slice(0, 5)}` : ''),
      url: '/finanze-app/agenda',
    })
    for (const s of subs.filter((x: { user_id: string }) => x.user_id === t.user_id)) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        // Sottoscrizione morta: pulizia
        if (status === 404 || status === 410) {
          await admin.from('push_subscriptions').delete().eq('id', s.id)
        } else {
          console.error('push error', status, s.endpoint.slice(0, 60))
        }
      }
    }
    await admin.from('tasks').update({ notified: true }).eq('id', t.id)
  }

  return json({ due: due.length, sent })
})
