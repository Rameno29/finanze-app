import { useEffect, useState, type ComponentType } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { BookOpen, Bot, ChevronRight, CircleUser, Fuel, LogOut, Settings } from 'lucide-react'
import { PageHeader } from '../../components/ui'
import { useIsDesktop } from '../../components/useIsDesktop'
import { useAuth } from '../../context/AuthContext'
import { callFunction, type IntegrationStatus } from '../../lib/integrations'
import { signOutEverywhere } from '../../lib/signOut'

function MoreRow({
  to,
  icon: Icon,
  title,
  subtitle,
  iconClass = 'text-brand',
}: {
  to: string
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  subtitle?: string
  iconClass?: string
}) {
  return (
    <Link to={to} className="flex min-h-[72px] items-center gap-4 border-b border-line">
      <Icon className={`h-6 w-6 shrink-0 ${iconClass}`} strokeWidth={1.9} />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium">{title}</span>
        {subtitle && <span className="block truncate text-[13px] text-muted">{subtitle}</span>}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.9} aria-hidden="true" />
    </Link>
  )
}

/** Solo mobile: raccoglie le pagine secondarie aperte dall'avatar della Home. */
export function MorePage() {
  const desktop = useIsDesktop()
  const { session } = useAuth()
  const [role, setRole] = useState<'owner' | 'guest' | null>(null)
  const [geminiReady, setGeminiReady] = useState<boolean | null>(null)
  const [signOutError, setSignOutError] = useState('')

  useEffect(() => {
    if (desktop) return
    let alive = true
    void callFunction<{ role: string }>('manage-invites', { action: 'status' })
      .then((data) => { if (alive) setRole(data.role === 'owner' ? 'owner' : 'guest') })
      .catch(() => {})
    void callFunction<{ integrations: IntegrationStatus[] }>('user-credentials', { action: 'list' })
      .then((data) => { if (alive) setGeminiReady(data.integrations.some((item) => item.provider === 'gemini')) })
      .catch(() => {})
    return () => { alive = false }
  }, [desktop])

  if (desktop) return <Navigate to="/impostazioni" replace />

  return (
    <div>
      <PageHeader title="Altro" />
      <div className="px-5">
        <div className="flex items-center gap-4 border-b border-line py-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
            <CircleUser className="h-7 w-7" strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold">{session?.user.email}</p>
            {role && <p className="text-[13px] text-muted">{role === 'owner' ? 'proprietario' : 'ospite'}</p>}
          </div>
        </div>
        <nav aria-label="Altre sezioni">
          <MoreRow
            to="/assistente"
            icon={Bot}
            iconClass="text-accent"
            title="Assistente AI"
            subtitle={geminiReady === null ? undefined : geminiReady ? 'Gemini · chiave personale attiva' : 'Chiave non impostata'}
          />
          <MoreRow to="/carburanti" icon={Fuel} title="Carburanti" subtitle="Prezzi dei distributori vicini" />
          <MoreRow to="/impostazioni" icon={Settings} title="Impostazioni" subtitle="Ospite, chiavi, tema, offline" />
          <MoreRow to="/guida" icon={BookOpen} title="Guida" subtitle="Come fare le cose in AJE" />
        </nav>
        <button
          type="button"
          onClick={() => {
            setSignOutError('')
            void signOutEverywhere().then((ok) => {
              if (!ok) setSignOutError('Uscita non riuscita. Controlla la connessione e riprova.')
            })
          }}
          className="flex min-h-[72px] w-full items-center gap-4 text-left text-base font-medium text-expense"
        >
          <LogOut className="h-6 w-6 shrink-0" strokeWidth={1.9} aria-hidden="true" />
          Esci
        </button>
        {signOutError && <p role="alert" className="text-sm text-expense">{signOutError}</p>}
        <p className="mt-6 text-xs text-muted">AJE · v1.0</p>
      </div>
    </div>
  )
}
