import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/ui'

const CREAM = '#F2EDE4'

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3.5 text-[16px] text-[#F2EDE4] placeholder-white/30 outline-none transition focus:border-[#F2EDE4]/40 focus:bg-black/35'

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
    <div
      className="pt-safe pb-safe relative flex min-h-dvh flex-col justify-center overflow-hidden px-6"
      style={{
        background:
          'radial-gradient(140% 90% at 50% -20%, #0d6b56 0%, #064c3e 35%, #03372f 65%, #021f1b 100%)',
      }}
    >
      {/* bagliori decorativi */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ background: '#2dd4a7' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 bottom-10 h-80 w-80 rounded-full opacity-10 blur-3xl"
        style={{ background: '#F2EDE4' }}
      />

      <div className="relative mx-auto w-full max-w-sm">
        <div className="mb-9 flex flex-col items-center text-center">
          <img
            src={`${import.meta.env.BASE_URL}pwa-192.png`}
            alt="Logo AJE"
            className="h-24 w-24 rounded-[26px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/15"
          />
          <h1
            className="mt-5 text-5xl font-black tracking-[0.35em] [text-indent:0.35em]"
            style={{ color: CREAM }}
          >
            AJE
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: `${CREAM}99` }}>
            Finanze, tempo e documenti. Tutto tuo.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl"
        >
          <label className="mb-4 block">
            <span className="mb-1.5 block text-sm font-medium" style={{ color: `${CREAM}B3` }}>
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              placeholder="nome@esempio.it"
            />
          </label>
          <label className="mb-5 block">
            <span className="mb-1.5 block text-sm font-medium" style={{ color: `${CREAM}B3` }}>
              Password
            </span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
              placeholder="Minimo 6 caratteri"
            />
          </label>

          {message && (
            <p
              className={`mb-4 rounded-xl px-4 py-3 text-sm ${
                message.kind === 'error'
                  ? 'bg-red-400/15 text-red-200'
                  : 'bg-emerald-400/15 text-emerald-200'
              }`}
            >
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl font-bold transition active:scale-[0.98] disabled:opacity-60"
            style={{ backgroundColor: CREAM, color: '#03372f' }}
          >
            {busy ? (
              <Spinner className="h-5 w-5 text-[#03372f]" />
            ) : mode === 'login' ? (
              'Accedi'
            ) : (
              'Crea account'
            )}
          </button>
        </form>

        <button
          className="mt-6 w-full py-2 text-center text-sm font-medium"
          style={{ color: `${CREAM}CC` }}
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
