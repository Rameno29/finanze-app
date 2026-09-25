import { useEffect, useRef, useState } from 'react'
import { inputClass } from '../../components/ui'
import { callFunction } from '../../lib/integrations'

interface Invite { id: string; email: string; status: string; expires_at: string; user_id: string | null }
interface Member { user_id: string; role: string; status: string }
interface Overview { invites: Invite[]; members: Member[]; has_more: boolean }
/** Riepilogo per l'intestazione della sezione Ospite. */
function summarize(overview: Overview): string {
  const active = overview.members.some((m) => m.role !== 'owner' && m.status === 'active')
  if (active) return 'Ospite attivo'
  return overview.invites.some((i) => i.status === 'pending') ? 'Invito inviato' : 'Nessuno'
}

export function InvitesPanel({ onSummary }: { onSummary?: (summary: string) => void } = {}) {
  const [owner, setOwner] = useState(false)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [preparedEmail, setPreparedEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(0)
  const onSummaryRef = useRef(onSummary)
  useEffect(() => { onSummaryRef.current = onSummary })
  async function reload(nextPage = 0) {
    const next = await callFunction<Overview>('manage-invites', { action: 'list', page: nextPage })
    setOverview(current => nextPage === 0 ? next : { ...next, invites: [...(current?.invites ?? []), ...next.invites], members: [...(current?.members ?? []), ...next.members] })
    if (nextPage === 0) onSummaryRef.current?.(summarize(next))
    setPage(nextPage)
  }
  useEffect(() => {
    let live = true
    void callFunction<{role:string}>('manage-invites', { action: 'status' }).then(async data => {
      if (!live || data.role !== 'owner') return
      setOwner(true); await reload()
    }).catch(() => { /* pannello solo per amministratore verificato */ })
    return () => { live = false }
  }, [])
  async function action(body: Record<string, unknown>, prepareEmail = false) {
    setBusy(true); setMessage(''); setLink(''); setPreparedEmail('')
    try {
      const result = await callFunction<{link?:string}>('manage-invites', body)
      if (result.link) {
        setLink(result.link)
        if (prepareEmail) setPreparedEmail(String(body.email))
      }
      setMessage(prepareEmail ? 'Invito pronto. Apri la tua app di posta per inviarlo.' : 'Operazione completata.')
      await reload()
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Operazione non riuscita.') }
    finally { setBusy(false) }
  }
  if (!owner) return null
  return <div><h3 className="mb-2 text-[15px] font-semibold">Utenti e inviti</h3>
    <p className="mb-3 text-sm text-muted">Solo tu gestisci gli inviti. Ogni persona usa il proprio account e vede solo i propri dati.</p>
    <form onSubmit={e => { e.preventDefault(); void action({ action: 'create', email, delivery: 'link' }) }}>
      <label className="text-sm">Email dell’ospite<input className={inputClass} type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
      <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-white">Genera invito</button>
        <button type="button" disabled={busy || !email.includes('@')} onClick={() => void action({ action: 'create', email, delivery: 'link' }, true)} className="min-h-11 rounded-full border border-line px-5 text-sm font-medium">Prepara email</button></div>
    </form>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    {link && <div className="mt-3"><label className="text-sm">Link personale dell’invito<input readOnly className={inputClass} value={link} onFocus={e => e.target.select()} /></label><div className="flex flex-wrap items-center gap-3"><button onClick={() => void navigator.clipboard.writeText(link).then(() => setMessage('Link copiato.')).catch(() => setMessage('Seleziona il link e copialo manualmente.'))} className="min-h-11 text-accent">Copia link invito</button>{preparedEmail && <a className="inline-flex min-h-11 items-center text-accent" href={`mailto:${encodeURIComponent(preparedEmail)}?subject=${encodeURIComponent('Invito ad AJE')}&body=${encodeURIComponent(`Ciao,\n\nTi invito ad AJE. Apri questo link personale per attivare il tuo account:\n${link}\n\nSe il link scade, chiedimi un nuovo invito.`)}`}>Apri app di posta</a>}</div><p className="text-xs text-muted">Condividilo solo con l’invitato. Se scade, genera un nuovo invito.</p></div>}
    <ul className="mt-4 divide-y divide-line">{overview?.invites.map(invite => {
      const member = overview.members.find(m => m.user_id === invite.user_id)
      const active = member?.status === 'active'
      return <li key={invite.id} className="py-3 text-sm"><p className="break-all font-medium">{invite.email}</p><p className="text-muted">{active ? 'Attivo' : member?.status === 'suspended' ? 'Sospeso' : invite.status === 'pending' ? new Date(invite.expires_at).getTime() > Date.now() ? 'Invito pendente' : 'Invito scaduto' : 'Invito annullato'}</p>
        {!active && <button disabled={busy} onClick={() => void action({ action: 'create', email: invite.email, delivery: 'link' })} className="mr-4 min-h-11 text-accent">Rigenera link</button>}
        {invite.status === 'pending' && <button disabled={busy} onClick={() => void action({ action: 'cancel', invite_id: invite.id })} className="min-h-11 text-expense">Annulla invito</button>}
        {active && <button disabled={busy} onClick={() => { if (confirm('Sospendere l’accesso? I dati restano conservati.')) void action({ action: 'suspend', user_id: invite.user_id }) }} className="min-h-11 text-expense">Sospendi accesso</button>}
      </li>
    })}</ul>
    {overview?.has_more && <button disabled={busy} onClick={() => { setBusy(true); void reload(page + 1).catch(cause => setMessage(cause instanceof Error ? cause.message : 'Impossibile caricare altri inviti.')).finally(() => setBusy(false)) }} className="mt-3 min-h-11 text-accent">Carica altri inviti</button>}
  </div>
}
