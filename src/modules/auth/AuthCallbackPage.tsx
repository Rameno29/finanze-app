import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, updateSessionPassword } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { callFunction } from '../../lib/integrations'
import { sessionScope } from '../../lib/sessionScope'
import { Card, inputClass, PrimaryButton } from '../../components/ui'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [params] = useState(() => new URLSearchParams(window.location.hash.slice(1)))
  const { session } = useAuth()
  const verified = useRef<{ ticket: ReturnType<typeof sessionScope.capture>; token: string } | null>(
    !params.has('token_hash') && session ? { ticket: sessionScope.capture(), token: session.access_token } : null,
  )
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirmation) { setError('Le password non coincidono.'); return }
    if (password.length < 10) { setError('Usa almeno 10 caratteri.'); return }
    setBusy(true); setError('')
    try {
      const hash = params.get('token_hash')
      const type = params.get('type')
      if (hash && !verified.current) {
        if (type !== 'invite' && type !== 'recovery') throw new Error('Link non valido.')
        const { data, error: authError } = await supabase.auth.verifyOtp({ token_hash: hash, type })
        if (authError || !data.session) throw new Error('Link scaduto o già utilizzato. Richiedi un nuovo invito.')
        const ticket = sessionScope.capture()
        if (ticket.userId !== data.session.user.id) throw new Error('Account cambiato: riapri il link con l’account corretto.')
        verified.current = { ticket, token: data.session.access_token }
      }
      const original = verified.current
      if (!original) throw new Error('Link non valido o scaduto. Richiedine uno nuovo.')
      sessionScope.assert(original.ticket)
      const { data: current } = await supabase.auth.getSession()
      if (current.session?.user.id !== original.ticket.userId) throw new Error('Account cambiato: riapri il link con l’account corretto.')
      await updateSessionPassword(original.ticket, original.token, password)
      const inviteId = params.get('invite_id')
      if (inviteId && hash) await callFunction('manage-invites', { action: 'accept', invite_id: inviteId, token_hash: hash })
      window.history.replaceState({}, '', window.location.pathname)
      navigate('/impostazioni', { replace: true })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Operazione non riuscita.') }
    finally { setBusy(false) }
  }
  return <main className="mx-auto max-w-md px-5 py-12">
    <Card><h1 className="mb-3 text-2xl font-bold">Imposta la tua password</h1>
      <p className="mb-5 text-sm text-muted">Completa l’accesso ad AJE con l’account associato al link ricevuto.</p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label>Nuova password<input className={inputClass} type="password" autoComplete="new-password" minLength={10} required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label>Ripeti password<input className={inputClass} type="password" autoComplete="new-password" minLength={10} required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-expense">{error}</p>}
        <PrimaryButton disabled={busy} type="submit">{busy ? 'Attendi…' : 'Salva e continua'}</PrimaryButton>
        <button type="button" disabled={busy} onClick={() => { window.history.replaceState({}, '', window.location.pathname); void supabase.auth.signOut().then(() => navigate('/', { replace: true })) }}>Torna al login</button>
      </form>
    </Card>
  </main>
}
