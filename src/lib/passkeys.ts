/**
 * Accesso con passkey (WebAuthn): su iPhone usa Face ID/Touch ID, su PC
 * Windows Hello o la chiave di sicurezza. La chiave privata resta sul
 * dispositivo; Supabase Auth conserva solo la chiave pubblica.
 */

export interface Passkey {
  id: string
  friendly_name?: string
  created_at: string
  last_used_at?: string
}

/** Il browser supporta la cerimonia WebAuthn? */
export function passkeySupported(): boolean {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window && 'credentials' in navigator
}

/** Traduce gli errori delle passkey in messaggi comprensibili in italiano. */
export function passkeyErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  const name = (error as { name?: string } | null)?.name
  switch (code) {
    case 'passkey_disabled':
      return 'Le passkey non sono ancora attive: vanno abilitate una volta dal pannello Supabase.'
    case 'too_many_passkeys':
      return 'Hai raggiunto il numero massimo di passkey per questo account: elimina quelle vecchie.'
    case 'webauthn_credential_exists':
      return 'Questo dispositivo ha già una passkey per il tuo account.'
    case 'webauthn_credential_not_found':
      return 'Passkey non riconosciuta: registrane una da Altro → Passkey dopo aver fatto l’accesso.'
    case 'webauthn_challenge_expired':
      return 'Tempo scaduto: riprova.'
    case 'user_banned':
    case 'email_not_confirmed':
      return 'Account non ancora attivo: conferma prima l’email.'
    default:
      // NotAllowedError = utente ha annullato la richiesta di Face ID / passkey
      if (name === 'NotAllowedError') return 'Operazione annullata.'
      return 'Operazione con la passkey non riuscita, riprova.'
  }
}
