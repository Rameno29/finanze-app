import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  Bot,
  ChevronRight,
  Globe,
  LogOut,
  Moon,
  Music,
  Smartphone,
  Sparkles,
  Sun,
  CloudOff,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useTheme, type ThemeSetting } from '../../context/ThemeContext'
import {
  disablePush,
  enablePush,
  getPushSubscription,
  needsInstallForPush,
  pushSupported,
  sendTestNotification,
} from '../../lib/push'
import { Card, PageHeader, Spinner } from '../../components/ui'

const THEME_OPTIONS: Array<{ value: ThemeSetting; label: string; icon: typeof Sun }> = [
  { value: 'system', label: 'Sistema', icon: Smartphone },
  { value: 'light', label: 'Chiaro', icon: Sun },
  { value: 'dark', label: 'Scuro', icon: Moon },
]

export function SettingsPage() {
  const { session } = useAuth()
  const { setting, setSetting } = useTheme()

  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  const [testBusy, setTestBusy] = useState(false)

  useEffect(() => {
    void getPushSubscription()
      .then((s) => setPushOn(s !== null))
      .catch(() => setPushMsg('Non riesco a leggere lo stato delle notifiche.'))
  }, [])

  async function testPush() {
    setTestBusy(true)
    setPushMsg('')
    try {
      const res = await sendTestNotification()
      setPushMsg(
        res.ok
          ? 'Notifica di prova inviata: dovrebbe arrivarti tra pochi secondi. Se non la vedi, controlla che le notifiche di AJE siano attive in Impostazioni iPhone.'
          : res.reason === 'nessuna_sottoscrizione'
            ? 'Prima attiva le notifiche qui sopra.'
            : 'Invio non riuscito: prova a disattivare e riattivare le notifiche.',
      )
    } catch {
      setPushMsg('Invio non riuscito: controlla la connessione e riprova.')
    } finally {
      setTestBusy(false)
    }
  }

  async function togglePush() {
    setPushBusy(true)
    setPushMsg('')
    try {
      if (pushOn) {
        await disablePush()
        setPushOn(false)
      } else {
        const res = await enablePush()
        if (res.ok) {
          setPushOn(true)
          setPushMsg('Notifiche attive! Riceverai un avviso per le attività in scadenza.')
        } else if (res.reason === 'permesso_negato') {
          setPushMsg('Permesso negato: abilitalo dalle impostazioni del telefono per questa app.')
        } else {
          setPushMsg('Attivazione non riuscita, riprova.')
        }
      }
    } catch {
      setPushMsg('Operazione non riuscita: controlla la connessione e riprova.')
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="pb-28">
      <PageHeader title="Altro" subtitle="Impostazioni e informazioni" />

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-5 pt-4">
        <Card className="divide-y divide-line p-0">
          <Link to="/assistente" className="flex min-h-[52px] items-center gap-3 px-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Bot className="h-4 w-4" />
            </span>
            <span className="flex-1 font-medium">Assistente</span>
            <span className="text-xs text-muted">Domande sulle tue finanze</span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </Link>
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
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Bell className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Notifiche promemoria</span>
              <span className="block text-xs text-muted">
                Un avviso quando un'attività dell'agenda è in scadenza
              </span>
            </span>
            {pushSupported() && !needsInstallForPush() ? (
              <button
                onClick={() => void togglePush()}
                disabled={pushBusy}
                role="switch"
                aria-checked={pushOn}
                aria-label="Attiva o disattiva le notifiche"
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                  pushOn ? 'bg-income' : 'bg-card-2 border border-line'
                }`}
              >
                {pushBusy ? (
                  <Spinner className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2" />
                ) : (
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                      pushOn ? 'left-7' : 'left-1'
                    }`}
                  />
                )}
              </button>
            ) : null}
          </div>
          {!pushSupported() && (
            <p className="mt-3 text-xs text-muted">Questo browser non supporta le notifiche push.</p>
          )}
          {pushSupported() && needsInstallForPush() && (
            <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2.5 text-xs text-accent">
              Su iPhone le notifiche funzionano solo con l'app installata: Safari → Condividi →
              "Aggiungi a schermata Home", poi attivale da qui.
            </p>
          )}
          {pushOn && (
            <button
              onClick={() => void testPush()}
              disabled={testBusy}
              className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-accent disabled:opacity-60"
            >
              {testBusy ? <Spinner className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              Invia notifica di prova
            </button>
          )}
          {pushMsg && <p className="mt-3 rounded-xl bg-card-2 px-3 py-2.5 text-xs">{pushMsg}</p>}
        </Card>

        <Card>
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <CloudOff className="h-4 w-4 text-accent" /> Modalità offline automatica
          </h2>
          <p className="text-sm text-muted">
            Le ultime viste di Finanze e Agenda sono cifrate sul dispositivo. Senza rete puoi
            consultarle e modificare movimenti o attività; AJE sincronizza la coda appena torni online.
            Token, documenti e allegati non vengono duplicati nella cache offline.
          </p>
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
