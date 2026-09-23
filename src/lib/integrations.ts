import { authenticatedClient, supabase } from './supabase'
import { sessionScope } from './sessionScope'

export type Provider = 'gemini' | 'youtube' | 'google' | 'spotify'
export interface IntegrationStatus { provider: Provider; suffix: string; updated_at: string; client_id?: string }

const messages: Record<string, string> = {
  unauthorized: 'Sessione scaduta. Accedi di nuovo.',
  access_denied: 'Questo account non è abilitato.',
  missing_api_key: 'Configura la tua chiave personale in Impostazioni → Le mie integrazioni.',
  credential_service_unavailable: 'Il servizio delle chiavi deve essere configurato dal proprietario.',
  invalid_credential: 'Chiave non valida o servizio non abilitato nel tuo progetto.',
  rate_limit: 'Limite di richieste raggiunto. Attendi un minuto e riprova.',
  provider_quota: 'Quota del tuo servizio esaurita. Controlla il pannello del provider.',
  provider_unavailable: 'Il servizio esterno non risponde. Riprova più tardi.',
  capacity_reached: 'Il posto ospite è già occupato o riservato da un invito.',
  invalid_invite: 'Invito scaduto, annullato o già utilizzato. Richiedine uno nuovo.',
  invite_changed: 'L’invito è cambiato. Aggiorna la lista e riprova.',
  smtp_unavailable: 'Email non configurata: genera e copia il link d’invito.',
  invalid_input: 'Controlla i dati inseriti.',
}

export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const ticket = sessionScope.capture()
  const auth = await supabase.auth.getSession()
  sessionScope.assert(ticket)
  if (!auth.data.session || auth.data.session.user.id !== ticket.userId) throw new Error(messages.unauthorized)
  const { data, error } = await authenticatedClient(auth.data.session.access_token).functions.invoke(name, { body })
  sessionScope.assert(ticket)
  if (error) {
    let code = ''
    try { code = (await (error.context as Response)?.json())?.error ?? '' } catch { /* errore rete */ }
    throw new Error(messages[code] ?? 'Servizio non disponibile. Controlla la connessione o la configurazione server.')
  }
  if (data?.error) throw new Error(messages[data.error] ?? 'Operazione non riuscita.')
  return data as T
}

/** Compatible response shape for existing modules, with safe errors and identity checks. */
export async function invokeFunction<T = any>(name: string, options: { body: Record<string, unknown> }): Promise<{ data: T | null; error: Error | null }> {
  try { return { data: await callFunction<T>(name, options.body), error: null } }
  catch (error) { return { data: null, error: error instanceof Error ? error : new Error('Operazione non riuscita.') } }
}
