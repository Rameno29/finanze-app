import { authenticatedClient, supabase } from './supabase'
import { sessionScope } from './sessionScope'
import type { DocumentRow } from '../types'

/** Storage and Postgres cannot commit together. Reconcile an ambiguous insert by
 * its preallocated ID; never compensate a lost response by deleting a live file. */
export async function uploadDocument(file: File, docType: DocumentRow['doc_type']): Promise<DocumentRow> {
  const ticket = sessionScope.capture()
  const { data: auth } = await supabase.auth.getSession()
  sessionScope.assert(ticket)
  if (!auth.session || auth.session.user.id !== ticket.userId) throw new Error('Sessione scaduta: accedi di nuovo.')
  const client = authenticatedClient(auth.session.access_token)
  const id = crypto.randomUUID()
  const path = `${ticket.userId}/${id}-${file.name.replace(/[^\w.-]/g, '_')}`
  const { error: uploadError } = await client.storage.from('documents').upload(path, file)
  sessionScope.assert(ticket)
  if (uploadError) throw new Error('Caricamento non riuscito. Controlla la connessione e riprova.')

  const { data, error } = await client.from('documents').insert({
    id, user_id: ticket.userId, doc_type: docType, storage_path: path, file_name: file.name,
  }).select().single()
  sessionScope.assert(ticket)
  if (!error && data) return data as DocumentRow

  const uncertain = 'Esito del salvataggio incerto. Aggiorna l’elenco dei documenti prima di riprovare; il file non è stato eliminato.'
  // Even a successful empty read cannot rule out an insert still being processed.
  const existing = await client.from('documents').select('*').eq('id', id).maybeSingle()
  sessionScope.assert(ticket)
  if (existing.data && !existing.error) return existing.data as DocumentRow
  const rejected = /^(22|23)/.test(error?.code ?? '') || error?.code === '42501'
  if (rejected && !existing.error) {
    await client.storage.from('documents').remove([path])
    throw new Error('Salvataggio rifiutato. Controlla i dati e l’accesso prima di riprovare.')
  }
  throw new Error(uncertain)
}
