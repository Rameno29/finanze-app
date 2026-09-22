import { useEffect, useState } from 'react'
import { Card, inputClass } from '../../components/ui'
import { callFunction } from '../../lib/integrations'

interface Invite { id: string; email: string; status: string; expires_at: string; user_id: string | null }
interface Member { user_id: string; role: string; status: string }
interface Overview { invites: Invite[]; members: Member[]; guest_limit: number }
export function InvitesPanel() {
  const [owner, setOwner] = useState(false)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  async function reload() { setOverview(await callFunction<Overview>('manage-invites', { action: 'list' })) }
  useEffect(() => {
    let live = true
    void callFunction<{role:string}>('manage-invites', { action: 'status' }).then(async data => {
      if (!live || data.role !== 'owner') return
      setOwner(true); await reload()
    }).catch(() => { /* pannello solo per amministratore verificato */ })
    return () => { live = false }
  }, [])
  async function action(body: Record<string, unknown>) {
    setBusy(true); setMessage(''); setLink('')
    try {
      const result = await callFunction<{link?:string;email_sent?:boolean}>('manage-invites', body)
      if (result.link) setLink(result.link)
      setMessage(body.delivery === 'email' ? result.email_sent ? 'Invito inviato.' : 'Email non inviata. Puoi copiare il link qui sotto.' : 'Operazione completata.')
      await reload()
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Operazione non riuscita.') }
    finally { setBusy(false) }
  }
  if (!owner) return null
  return <Card><h2 className="mb-2 text-lg font-bold">Utenti e inviti</h2>
    <p className="mb-3 text-sm text-muted">Solo tu gestisci gli inviti. Posti ospite previsti: {overview?.guest_limit ?? 1}. Gli inviti pendenti riservano un posto.</p>
    <form onSubmit={e => { e.preventDefault(); void action({ action: 'create', email, delivery: 'link' }) }}>
      <label className="text-sm">Email dell’ospite<input className={inputClass} type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
      <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} className="min-h-11 rounded-xl bg-accent px-4 text-white">Genera invito</button>
        <button type="button" disabled={busy || !email.includes('@')} onClick={() => void action({ action: 'create', email, delivery: 'email' })} className="min-h-11 rounded-xl border border-line px-4">Invia per email</button></div>
    </form>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    {link && <div className="mt-3"><label className="text-sm">Link personale dell’invito<input readOnly className={inputClass} value={link} onFocus={e => e.target.select()} /></label><button onClick={() => void navigator.clipboard.writeText(link).then(() => setMessage('Link copiato.')).catch(() => setMessage('Seleziona il link e copialo manualmente.'))} className="min-h-11 text-accent">Copia link invito</button><p className="text-xs text-muted">Condividilo solo con l’invitato. Se scade, genera un nuovo invito.</p></div>}
    <ul className="mt-4 divide-y divide-line">{overview?.invites.map(invite => {
      const member = overview.members.find(m => m.user_id === invite.user_id)
      const active = member?.status === 'active'
      return <li key={invite.id} className="py-3 text-sm"><p className="break-all font-medium">{invite.email}</p><p className="text-muted">{active ? 'Attivo' : member?.status === 'suspended' ? 'Sospeso' : invite.status === 'pending' ? new Date(invite.expires_at).getTime() > Date.now() ? 'Invito pendente' : 'Invito scaduto' : 'Invito annullato'}</p>
        {!active && <button disabled={busy} onClick={() => void action({ action: 'create', email: invite.email, delivery: 'link' })} className="mr-4 min-h-11 text-accent">Rigenera link</button>}
        {invite.status === 'pending' && <button disabled={busy} onClick={() => void action({ action: 'cancel', invite_id: invite.id })} className="min-h-11 text-expense">Annulla invito</button>}
        {active && <button disabled={busy} onClick={() => { if (confirm('Sospendere l’accesso? I dati restano conservati.')) void action({ action: 'suspend', user_id: invite.user_id }) }} className="min-h-11 text-expense">Sospendi accesso</button>}
      </li>
    })}</ul>
  </Card>
}
