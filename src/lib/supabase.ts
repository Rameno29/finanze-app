import { createClient } from '@supabase/supabase-js'
import { sessionScope } from './sessionScope'

const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://boucbthrnddmnzcowafy.supabase.co'
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_dKViNdk1yNGARxVb3KydBg_FPd0GCRb'

export const supabase = createClient(url, anonKey, {
  // Passkey (WebAuthn): API sperimentale di Supabase, richiesta per Face ID/Touch ID.
  auth: { experimental: { passkey: true } },
})

/** A request already started by A must not acquire B's token after a session switch. */
export function authenticatedClient(token: string) {
  return createClient(url, anonKey, { accessToken: async () => token })
}

/** Password reset must stay bound to the identity verified by the original link.
 * Use Auth's fixed endpoint: updateUser() would reread the shared browser session.
 * Do not persist a returned user/session over another tab's newer login.
 */
export async function updateSessionPassword(ticket: ReturnType<typeof sessionScope.capture>, token: string, password: string) {
  sessionScope.assert(ticket)
  const response = await fetch(`${url}/auth/v1/user`, {
    method: 'PUT',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  sessionScope.assert(ticket)
  if (!response.ok) throw new Error('Password non accettata. Usa una password più lunga o richiedi un nuovo link.')
}

/** Restituisce l'utente autenticato o interrompe il flusso prima di scrivere dati incompleti. */
export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Sessione scaduta: accedi di nuovo.')
  return data.user.id
}
