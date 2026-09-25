import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { ensureDefaultCategories } from '../../lib/seedCategories'
import { Lock, TriangleAlert } from 'lucide-react'
import { FullPageSpinner } from '../../components/ui'
import { sessionScope } from '../../lib/sessionScope'

/** UI gate only. Actual authorization is always enforced by RLS and Edge Functions. */
export function MembershipGate({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'active' | 'denied' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let alive = true
    const ticket = sessionScope.capture()
    const cacheKey = `aje-membership:${userId}`
    const check = async () => {
      try {
        if (!navigator.onLine) {
          if (alive) setState(localStorage.getItem(cacheKey) === 'active' ? 'active' : 'error')
          return
        }
        const { data, error } = await supabase.from('app_members').select('status').eq('user_id', userId).maybeSingle()
        sessionScope.assert(ticket)
        if (!alive) return
        if (error) { setState('error'); return }
        const active = data?.status === 'active'
        try { if (active) localStorage.setItem(cacheKey, 'active'); else localStorage.removeItem(cacheKey) } catch { /* offline cache unavailable */ }
        setState(active ? 'active' : 'denied')
        if (active) void ensureDefaultCategories(userId).catch(() => {})
      } catch { if (alive) setState('error') }
    }
    void check()
    const interval = window.setInterval(() => void check(), 60_000)
    window.addEventListener('online', check)
    window.addEventListener('focus', check)
    return () => { alive = false; window.clearInterval(interval); window.removeEventListener('online', check); window.removeEventListener('focus', check) }
  }, [userId, retry])
  if (state === 'loading') return <FullPageSpinner />
  if (state === 'active') return children
  const denied = state === 'denied'
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
    {denied
      ? <Lock className="h-9 w-9 text-muted" strokeWidth={1.9} aria-hidden="true" />
      : <TriangleAlert className="h-9 w-9 text-expense" strokeWidth={1.9} aria-hidden="true" />}
    <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">{denied ? 'Il tuo accesso è sospeso' : 'Non riesco a verificare l’accesso'}</h1>
    <p role="alert" className="mt-2 text-[15px] leading-[1.55] text-muted">
      {denied
        ? 'Account non abilitato o sospeso. Completa il link d’invito ricevuto oppure contatta il proprietario: i tuoi dati restano conservati.'
        : 'Controlla la connessione e la configurazione del servizio, poi riprova.'}
    </p>
    {!denied && (
      <button
        onClick={() => setRetry(value => value + 1)}
        className="mt-6 min-h-12 w-full rounded-[16px] bg-accent text-[15px] font-semibold text-white"
      >
        Riprova
      </button>
    )}
    <button
      onClick={() => void supabase.auth.signOut()}
      className={`${denied ? 'mt-6' : 'mt-3'} min-h-12 w-full rounded-[16px] border border-line text-[15px] font-semibold`}
    >
      {denied ? 'Esci' : 'Torna al login'}
    </button>
    {denied && (
      <button onClick={() => setRetry(value => value + 1)} className="mt-2 min-h-11 text-sm font-semibold text-accent">
        Riprova
      </button>
    )}
  </main>
}
