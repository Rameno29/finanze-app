import { supabase } from './supabase'
import { VAPID_PUBLIC_KEY } from './config'

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
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** Chiede il permesso, sottoscrive e salva la sottoscrizione sul database. */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: 'non_supportato' }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'permesso_negato' }

  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }))

  const json = sub.toJSON()
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userData.user!.id,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    },
    { onConflict: 'endpoint' },
  )
  if (error) return { ok: false, reason: 'salvataggio_fallito' }
  return { ok: true }
}

export async function disablePush(): Promise<void> {
  const sub = await getPushSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
