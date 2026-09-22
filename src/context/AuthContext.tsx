import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { clearExternalSessions, sessionScope } from '../lib/sessionScope'
import { setPushIdentity } from '../lib/push'

interface AuthContextValue {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    let authEventReceived = false
    let previous: string | null | undefined
    try { for (const storage of [localStorage, sessionStorage]) {
      for (const key of ['google_token', 'spotify_token', 'spotify_state', 'spotify_verifier']) storage.removeItem(key)
    } } catch { /* Storage unavailable */ }
    const applySession = (next: Session | null) => {
      if (!alive) return
      const id = next?.user.id ?? null
      if (previous !== undefined && previous !== id) clearExternalSessions()
      previous = id
      sessionScope.set(id)
      void setPushIdentity(id).catch(() => {})
      setSession(next)
      setLoading(false)
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      authEventReceived = true
      applySession(s)
    })
    void supabase.auth.getSession().then(({ data }) => {
      if (!authEventReceived) applySession(data.session)
    }).catch(() => { if (!authEventReceived) applySession(null) })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
