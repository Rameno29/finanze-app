import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://boucbthrnddmnzcowafy.supabase.co'
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_dKViNdk1yNGARxVb3KydBg_FPd0GCRb'

export const supabase = createClient(url, anonKey, {
  // Passkey (WebAuthn): API sperimentale di Supabase, richiesta per Face ID/Touch ID.
  auth: { experimental: { passkey: true } },
})

/** Restituisce l'utente autenticato o interrompe il flusso prima di scrivere dati incompleti. */
export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Sessione scaduta: accedi di nuovo.')
  return data.user.id
}
