import { authenticatedClient, supabase } from './supabase'
import { invokeFunction } from './integrations'
import { VAPID_PUBLIC_KEY } from './config'
import { sessionScope } from './sessionScope'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Su iPhone le notifiche web funzionano solo con l'app installata sulla schermata Home. */
export function needsInstallForPush(): boolean {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  return isIOS && !standalone
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  return reg ? reg.pushManager.getSubscription() : null
}

/** Chiede il permesso, sottoscrive e salva la sottoscrizione sul database. */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  const ticket = sessionScope.capture()
  if (!pushSupported()) return { ok: false, reason: 'non_supportato' }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'permesso_negato' }

  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  sessionScope.assert(ticket)
  if (!reg) return { ok: false, reason: 'non_supportato' }
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }))

  const json = sub.toJSON()
  const { data: authData, error: userError } = await supabase.auth.getSession()
  if (userError || !authData.session || authData.session.user.id !== ticket.userId) {
    await sub.unsubscribe()
    return { ok: false, reason: 'non_autenticato' }
  }
  try { sessionScope.assert(ticket) } catch { await sub.unsubscribe(); return { ok: false, reason: 'non_autenticato' } }
  const { error } = await authenticatedClient(authData.session.access_token).from('push_subscriptions').upsert(
    {
      user_id: ticket.userId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    },
    { onConflict: 'endpoint' },
  )
  sessionScope.assert(ticket)
  if (error) { await sub.unsubscribe(); return { ok: false, reason: 'salvataggio_fallito' } }
  await setPushIdentity(ticket.userId)
  return { ok: true }
}

export async function disablePush(): Promise<void> {
  await setPushIdentity(null)
  const sub = await getPushSubscription()
  if (!sub) return
  // Unsubscribe locally first: logout must remain private even without a working network.
  await sub.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
}

let identityWrite = Promise.resolve()
export function setPushIdentity(userId: string | null): Promise<void> {
  // CacheStorage writes are asynchronous: logout must land after an older login write.
  identityWrite = identityWrite.catch(() => {}).then(async () => {
    if (!('caches' in window)) return
    const write = async () => {
      const cache = await caches.open('aje-push-identity-v1')
      const key = new URL(`${import.meta.env.BASE_URL}push-identity`, location.origin).href
      await cache.put(key, new Response(JSON.stringify({ userId })))
    }
    if (navigator.locks) await navigator.locks.request('aje-push-identity', write)
    else await write()
  })
  return identityWrite
}

/** Invia subito una notifica di prova alle sottoscrizioni dell'utente. */
export async function sendTestNotification(): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await invokeFunction('send-reminders', {
    body: { test: true },
  })
  if (error) {
    let reason = ''
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) reason = (await ctx.json())?.error ?? ''
    } catch {
      /* corpo non JSON */
    }
    return { ok: false, reason: reason || 'invio_fallito' }
  }
  const sent = (data as { sent?: number }).sent ?? 0
  return sent > 0 ? { ok: true } : { ok: false, reason: 'nessun_invio' }
}
