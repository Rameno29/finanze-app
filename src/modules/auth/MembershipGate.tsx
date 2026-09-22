import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { ensureDefaultCategories } from '../../lib/seedCategories'
import { FullPageSpinner, PrimaryButton } from '../../components/ui'
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
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
    <h1 className="text-2xl font-semibold">Accesso AJE</h1>
    <p role="alert">{state === 'denied' ? 'Account non abilitato o sospeso. Completa il link d’invito ricevuto oppure contatta il proprietario.' : 'Non riesco a verificare l’accesso. Controlla la connessione e la configurazione del servizio.'}</p>
    <PrimaryButton onClick={() => setRetry(value => value + 1)}>Riprova</PrimaryButton>
    <button onClick={() => void supabase.auth.signOut()}>Torna al login</button>
  </main>
}
