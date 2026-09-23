import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Fingerprint } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { passkeyErrorMessage, passkeySupported } from '../../lib/passkeys'
import { Spinner } from '../../components/ui'

const fieldClass =
  'light-field w-full rounded-xl border border-line bg-card-2 px-4 py-3.5 text-[16px] placeholder:text-muted outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15'

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'recovery'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  /** Accesso con passkey: Face ID/Touch ID, senza email né password. */
  async function handlePasskey() {
    setPasskeyBusy(true)
    setMessage(null)
    try {
      const { error } = await supabase.auth.signInWithPasskey()
      if (error) setMessage({ kind: 'error', text: passkeyErrorMessage(error) })
      // In caso di successo AuthContext riceve SIGNED_IN e mostra l'app.
    } catch (cause) {
      setMessage({ kind: 'error', text: passkeyErrorMessage(cause) })
    } finally {
      setPasskeyBusy(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
        if (error) setMessage({ kind: 'error', text: 'Accesso non riuscito: controlla email e password.' })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: new URL(`${import.meta.env.BASE_URL}auth/callback`, window.location.origin).href,
        })
        if (error) {
          setMessage({ kind: 'error', text: 'Invio non riuscito. Riprova tra poco o contatta chi ti ha invitato.' })
        } else {
          setMessage({
            kind: 'info',
            text: 'Se l’account è abilitato, riceverai un’email per reimpostare la password.',
          })
          setMode('login')
        }
      }
    } catch {
      setMessage({ kind: 'error', text: 'Connessione non disponibile. Riprova tra poco.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page min-h-dvh bg-bg lg:grid lg:grid-cols-[1.08fr_.92fr]">
      <section
        className="login-hero relative flex min-h-[270px] flex-col justify-between overflow-hidden bg-cover bg-center px-6 pb-7 pt-safe text-white lg:sticky lg:top-0 lg:h-dvh lg:min-h-[640px] lg:px-14 lg:py-12"
        style={{ backgroundImage: `linear-gradient(90deg, rgb(4 47 40 / 86%), rgb(4 47 40 / 18%)), url("${import.meta.env.BASE_URL}aje-lake-hero.webp")` }}
      >
        <div className="relative z-10 flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}aje-leaf-icon.webp`} alt="" className="h-12 w-12 rounded-xl" />
          <div>
            <p className="text-xl font-bold tracking-[.32em]">AJE</p>
            <p className="text-xs text-white/75">Le tue finanze. Una vita più serena.</p>
          </div>
        </div>
        <div className="relative z-10 max-w-xl">
          <h1 className="display-type max-w-[12ch] text-4xl leading-[1.03] sm:text-5xl lg:text-6xl">
            Più consapevolezza ogni giorno.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/85 sm:text-base">
            Gestisci, pianifica, raggiungi. AJE è il tuo alleato finanziario, sempre con te.
          </p>
          <p className="mt-8 hidden text-sm italic text-white/75 lg:block">Un domani più tuo.</p>
        </div>
      </section>

      <main className="flex min-h-[calc(100dvh-270px)] items-center justify-center px-5 py-9 sm:px-8 lg:min-h-dvh lg:px-12">
        <div className="w-full max-w-[440px]">
          <header className="mb-6">
            <p className="text-sm font-semibold text-accent">Il tuo spazio personale</p>
            <h2 className="display-type mt-1 text-3xl">{mode === 'login' ? 'Bentornato' : 'Recupera la password'}</h2>
            <p className="mt-1 text-sm text-muted">{mode === 'login' ? 'Accedi al tuo conto per continuare.' : 'Inserisci la tua email e ti invieremo il link di recupero.'}</p>
          </header>

        <form onSubmit={handleSubmit} className="app-card rounded-3xl border border-line bg-card p-5 shadow-sm sm:p-7">
          <label className="mb-4 block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Email</span>
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
          {mode === 'login' && <div className="mb-5 block">
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
              placeholder="Minimo 6 caratteri"
            />
            <button type="button" className="mt-2 flex min-h-11 items-center gap-2 text-sm text-accent" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              {showPassword ? 'Nascondi password' : 'Mostra password'}
            </button>
          </div>}

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
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-accent font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? (
              <Spinner className="h-5 w-5 text-white" />
            ) : mode === 'login' ? (
              'Accedi'
            ) : (
              'Invia link di recupero'
            )}
          </button>
        </form>

        {mode === 'login' && passkeySupported() && (
          <button
            onClick={() => void handlePasskey()}
            disabled={busy || passkeyBusy}
            className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-card font-semibold text-ink transition hover:bg-card-2 active:scale-[0.98] disabled:opacity-60"
          >
            {passkeyBusy ? (
              <Spinner className="h-5 w-5" />
            ) : (
              <>
                <Fingerprint className="h-5 w-5" /> Accedi con passkey (Face ID)
              </>
            )}
          </button>
        )}

        <button
          className="mt-6 w-full py-2 text-center text-sm font-medium"
          style={{ color: 'var(--muted)' }}
          onClick={() => {
            setMode(mode === 'login' ? 'recovery' : 'login')
            setMessage(null)
          }}
        >
          {mode === 'login' ? 'Password dimenticata?' : 'Torna ad Accedi'}
        </button>
        <p className="mt-4 text-center text-sm leading-relaxed text-muted">AJE è su invito. Per creare il tuo account, apri il link ricevuto dal proprietario.</p>
        </div>
      </main>
    </div>
  )
}
