import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Fingerprint } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { passkeyErrorMessage, passkeySupported } from '../../lib/passkeys'
import { Spinner } from '../../components/ui'

const CREAM = '#F2EDE4'

const fieldClass =
  'auth-field w-full rounded-xl border border-white/30 bg-black/25 px-4 py-3.5 text-[16px] text-[#F2EDE4] placeholder-white/65 outline-none transition focus:border-[#F2EDE4]/70 focus:bg-black/35'

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
          {mode === 'login' && <div className="mb-5 block">
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium" style={{ color: `${CREAM}B3` }}>
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
            <button type="button" className="mt-2 flex min-h-11 items-center gap-2 text-sm text-[#F2EDE4]" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword}>
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
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl font-bold transition active:scale-[0.98] disabled:opacity-60"
            style={{ backgroundColor: CREAM, color: '#03372f' }}
          >
            {busy ? (
              <Spinner className="h-5 w-5 text-[#03372f]" />
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
            className="mt-4 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] font-semibold backdrop-blur-xl transition active:scale-[0.98] disabled:opacity-60"
            style={{ color: CREAM }}
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
          style={{ color: `${CREAM}CC` }}
          onClick={() => {
            setMode(mode === 'login' ? 'recovery' : 'login')
            setMessage(null)
          }}
        >
          {mode === 'login' ? 'Password dimenticata?' : 'Torna ad Accedi'}
        </button>
        <p className="mt-4 text-center text-sm text-[#F2EDE4]/80">AJE è su invito. Per creare il tuo account, apri il link ricevuto dal proprietario.</p>
      </div>
    </div>
  )
}
