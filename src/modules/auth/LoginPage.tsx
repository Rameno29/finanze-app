import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, PrimaryButton, Spinner, inputClass } from '../../components/ui'

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setMessage({ kind: 'error', text: 'Accesso non riuscito: controlla email e password.' })
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: 'https://rameno29.github.io/finanze-app/' },
        })
        if (error) {
          setMessage({ kind: 'error', text: error.message })
        } else if (!data.session) {
          setMessage({
            kind: 'info',
            text: 'Registrazione avvenuta! Controlla la tua email e conferma l’account, poi accedi.',
          })
          setMode('login')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col justify-center bg-bg px-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img
            src={`${import.meta.env.BASE_URL}pwa-192.png`}
            alt="Logo AJE"
            className="h-20 w-20 rounded-2xl shadow-lg"
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AJE</h1>
            <p className="text-sm text-muted">La tua app personale per soldi e documenti</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Field label="Email">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="nome@esempio.it"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="Minimo 6 caratteri"
            />
          </Field>

          {message && (
            <p
              className={`mb-4 rounded-xl px-4 py-3 text-sm ${
                message.kind === 'error'
                  ? 'bg-expense/10 text-expense'
                  : 'bg-income/10 text-income'
              }`}
            >
              {message.text}
            </p>
          )}

          <PrimaryButton type="submit" disabled={busy}>
            {busy ? <Spinner className="h-5 w-5 text-white" /> : mode === 'login' ? 'Accedi' : 'Crea account'}
          </PrimaryButton>
        </form>

        <button
          className="mt-5 w-full py-2 text-center text-sm font-medium text-accent"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setMessage(null)
          }}
        >
          {mode === 'login' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
        </button>
      </div>
    </div>
  )
}
