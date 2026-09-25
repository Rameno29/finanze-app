import { useState, type FormEvent } from 'react'
import { Fingerprint } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { passkeyErrorMessage, passkeySupported } from '../../lib/passkeys'
import { Spinner } from '../../components/ui'

const fieldClass =
  'light-field h-[52px] w-full rounded-[14px] border border-line bg-card px-4 text-[16px] placeholder:text-muted outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15'

const primaryClass =
  'flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-accent text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60'

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'recovery'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [error, setError] = useState('')
  const [recoverySent, setRecoverySent] = useState(false)

  /** Accesso con passkey: Face ID/Touch ID, senza email né password. */
  async function handlePasskey() {
    setPasskeyBusy(true)
    setError('')
    try {
      const { error: passkeyError } = await supabase.auth.signInWithPasskey()
      if (passkeyError) setError(passkeyErrorMessage(passkeyError))
      // In caso di successo AuthContext riceve SIGNED_IN e mostra l'app.
    } catch (cause) {
      setError(passkeyErrorMessage(cause))
    } finally {
      setPasskeyBusy(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'login') {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
        if (loginError) setError('Accesso non riuscito: controlla email e password.')
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: new URL(`${import.meta.env.BASE_URL}auth/callback`, window.location.origin).href,
        })
        if (resetError) setError('Invio non riuscito. Riprova tra poco o contatta chi ti ha invitato.')
        else setRecoverySent(true)
      }
    } catch {
      setError('Connessione non disponibile. Riprova tra poco.')
    } finally {
      setBusy(false)
    }
  }

  function switchMode(next: 'login' | 'recovery') {
    setMode(next)
    setError('')
    setRecoverySent(false)
  }

  return (
    <main className="login-page flex min-h-dvh justify-center bg-bg px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+60px)] lg:py-[8vh]">
      <form onSubmit={handleSubmit} className="flex w-full max-w-[420px] flex-col">
        <img
          src={`${import.meta.env.BASE_URL}aje-wordmark-dark-v2.webp`}
          alt="AJE"
          className="h-[34px] w-auto self-start dark:brightness-0 dark:invert"
        />

        {mode === 'login' ? (
          <header className="mt-8">
            <h1 className="text-[38px] font-semibold leading-[1.1] tracking-[-0.03em]">Bentornato.</h1>
            <p className="mt-2 text-[15px] text-muted">Accedi per vedere conti, agenda e documenti.</p>
          </header>
        ) : (
          <header className="mt-8">
            <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.03em]">Recupera la password</h1>
            <p className="mt-2 text-[15px] text-muted">Ti mandiamo un link per sceglierne una nuova.</p>
          </header>
        )}

        <div className="mt-[30px]">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">Email</span>
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

          {mode === 'login' && (
            <div className="mt-4">
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-muted">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${fieldClass} pr-24`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 flex h-11 -translate-y-1/2 items-center rounded-xl px-3 text-sm font-semibold text-accent"
                >
                  {showPassword ? 'Nascondi' : 'Mostra'}
                </button>
              </div>
              <div className="mt-2 flex justify-end">
                <button type="button" onClick={() => switchMode('recovery')} className="min-h-11 text-sm font-semibold text-accent">
                  Password dimenticata?
                </button>
              </div>
            </div>
          )}

          {error && <p role="alert" className="mt-3 text-sm text-expense">{error}</p>}
          {mode === 'recovery' && recoverySent && (
            <p role="status" className="recovery-sent mt-4 rounded-[14px] bg-brand-soft px-4 py-3 text-sm text-brand">
              Link inviato. Controlla anche lo spam.
            </p>
          )}
        </div>

        <div className="mt-10 flex flex-1 flex-col justify-end gap-3">
          <button type="submit" disabled={busy} className={primaryClass}>
            {busy ? <Spinner className="h-5 w-5 text-white" /> : mode === 'login' ? 'Accedi' : recoverySent ? 'Invia di nuovo' : 'Invia il link'}
          </button>

          {mode === 'login' && passkeySupported() && (
            <button
              type="button"
              onClick={() => void handlePasskey()}
              disabled={busy || passkeyBusy}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] border border-line text-[16px] font-semibold transition active:scale-[0.98] disabled:opacity-60"
            >
              {passkeyBusy ? <Spinner className="h-5 w-5" /> : <><Fingerprint className="h-5 w-5" strokeWidth={1.9} /> Accedi con passkey</>}
            </button>
          )}

          {mode === 'recovery' && (
            <button type="button" onClick={() => switchMode('login')} className="min-h-12 text-[15px] font-semibold text-accent">
              Torna all’accesso
            </button>
          )}

          {mode === 'login' && (
            <p className="mt-1 text-center text-[13px] leading-[1.55] text-muted">
              La passkey usa Face ID, l’impronta o il PIN del dispositivo. Hai un invito? Apri il link ricevuto via email.
            </p>
          )}
        </div>
      </form>
    </main>
  )
}
