import { Link } from 'react-router-dom'
import { BookOpen, ChevronRight, Globe, LogOut, Moon, Music, Smartphone, Sparkles, Sun } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useTheme, type ThemeSetting } from '../../context/ThemeContext'
import { Card, PageHeader } from '../../components/ui'

const THEME_OPTIONS: Array<{ value: ThemeSetting; label: string; icon: typeof Sun }> = [
  { value: 'system', label: 'Sistema', icon: Smartphone },
  { value: 'light', label: 'Chiaro', icon: Sun },
  { value: 'dark', label: 'Scuro', icon: Moon },
]

export function SettingsPage() {
  const { session } = useAuth()
  const { setting, setSetting } = useTheme()

  return (
    <div className="pb-28">
      <PageHeader title="Altro" subtitle="Impostazioni e informazioni" />

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-5 pt-4">
        <Card className="divide-y divide-line p-0">
          <Link to="/google" className="flex min-h-[52px] items-center gap-3 px-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Globe className="h-4 w-4" />
            </span>
            <span className="flex-1 font-medium">Google</span>
            <span className="text-xs text-muted">Calendar · Gmail · Drive · Maps</span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </Link>
          <Link to="/media" className="flex min-h-[52px] items-center gap-3 px-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-income/15 text-income">
              <Music className="h-4 w-4" />
            </span>
            <span className="flex-1 font-medium">Media</span>
            <span className="text-xs text-muted">Spotify · YouTube</span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </Link>
          <Link to="/guida" className="flex min-h-[52px] items-center gap-3 px-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-expense/15 text-expense">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="flex-1 font-medium">Guida all'uso</span>
            <span className="text-xs text-muted">Come funziona AJE</span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </Link>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Tema</h2>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setSetting(value)}
                className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium ${
                  setting === value
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-card-2 text-muted'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-accent" /> Funzioni AI
          </h2>
          <p className="text-sm text-muted">
            Attive con Google Gemini (piano gratuito): analisi di buste paga, scontrini e
            documenti, e riassunti dei video YouTube. L’elaborazione avviene su una funzione
            sicura del server: la chiave non passa mai dal telefono.
          </p>
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">Account</h2>
          <p className="mb-4 text-sm text-muted">{session?.user.email}</p>
          <button
            onClick={() => void supabase.auth.signOut()}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-line font-semibold text-expense"
          >
            <LogOut className="h-5 w-5" /> Esci
          </button>
        </Card>

        <p className="pb-4 text-center text-xs text-muted">
          AJE · v1.0
          <br />
          Prossimi moduli: Agenda, Google, Musica e YouTube
        </p>
      </div>
    </div>
  )
}
