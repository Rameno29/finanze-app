import { supabase } from './supabase'
import { disablePush } from './push'
import { clearExternalSessions } from './sessionScope'

/** Esce dall'account: spegne le push del dispositivo (anche offline si prosegue) e chiude le sessioni esterne. */
export async function signOutEverywhere(): Promise<boolean> {
  try { await disablePush() } catch { /* procedi con il logout anche offline */ }
  clearExternalSessions()
  const { error } = await supabase.auth.signOut()
  return !error
}
