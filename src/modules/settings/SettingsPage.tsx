import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  Clock,
  Bot,
  ChevronDown,
  ChevronRight,
  CircleUser,
  CloudOff,
  Fingerprint,
  Fuel,
  KeyRound,
  LogOut,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { passkeyErrorMessage, passkeySupported, type Passkey } from '../../lib/passkeys'
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
import { callFunction, type IntegrationStatus } from '../../lib/integrations'
import { listPendingChanges, subscribeOfflineStatus, syncOffline, type OfflineStatus, type PendingChange } from '../../lib/offline'
import { PageHeader, Spinner } from '../../components/ui'
import { Segmented } from '../../components/Segmented'
import { Switch } from '../../components/Switch'
import { IntegrationsPanel } from './IntegrationsPanel'
import { InvitesPanel } from './InvitesPanel'
import { signOutEverywhere } from '../../lib/signOut'

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

  // Passkey (Face ID/Touch ID)
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [passkeyMsg, setPasskeyMsg] = useState('')

  useEffect(() => {
    if (!passkeySupported() || !navigator.onLine) return
    void supabase.auth.passkey
      .list()
      .then(({ data, error }) => {
        if (error) setPasskeyMsg(passkeyErrorMessage(error))
        else setPasskeys(data ?? [])
      })
      .catch((cause: unknown) => setPasskeyMsg(passkeyErrorMessage(cause)))
  }, [])

  async function addPasskey() {
    setPasskeyBusy(true)
    setPasskeyMsg('')
    try {
      const { data, error } = await supabase.auth.registerPasskey()
      if (error) {
        setPasskeyMsg(passkeyErrorMessage(error))
      } else if (data) {
        setPasskeys((prev) => [...prev, data as Passkey])
        setPasskeyMsg('Passkey creata! Dalla prossima volta puoi accedere con Face ID.')
      }
    } catch (cause) {
      setPasskeyMsg(passkeyErrorMessage(cause))
    } finally {
      setPasskeyBusy(false)
    }
  }

  async function removePasskey(passkey: Passkey) {
    if (!window.confirm(`Eliminare la passkey "${passkey.friendly_name ?? 'senza nome'}"? Non potrai più usarla per accedere.`)) return
    setPasskeyBusy(true)
    setPasskeyMsg('')
    try {
      const { error } = await supabase.auth.passkey.delete({ passkeyId: passkey.id })
      if (error) setPasskeyMsg(passkeyErrorMessage(error))
      else setPasskeys((prev) => prev.filter((p) => p.id !== passkey.id))
    } catch (cause) {
      setPasskeyMsg(passkeyErrorMessage(cause))
    } finally {
      setPasskeyBusy(false)
    }
  }

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

  const userId = session?.user.id ?? ''
  const [open, setOpen] = useState<ReadonlySet<SectionId>>(() => new Set<SectionId>(['chiavi', 'ospite']))
  const [owner, setOwner] = useState(false)
  const [guestSummary, setGuestSummary] = useState('')
  const [logoutError, setLogoutError] = useState('')
  const [integrations, setIntegrations] = useState<IntegrationStatus[] | null>(null)
  const [offline, setOffline] = useState<OfflineStatus>({ online: navigator.onLine, syncing: false, pending: 0, lastError: null })
  const permission = typeof Notification === 'undefined' ? 'default' : Notification.permission

  useEffect(() => {
    let alive = true
    void callFunction<{ role: string }>('manage-invites', { action: 'status' })
      .then((data) => { if (alive) setOwner(data.role === 'owner') })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => (userId ? subscribeOfflineStatus(userId, setOffline) : undefined), [userId])

  // Da un collegamento con #integrazioni (es. Assistente senza chiave) si scorre alla sezione.
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const timer = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }), 300)
    return () => window.clearTimeout(timer)
  }, [hash])

  // Elenco delle modifiche in coda: si rilegge quando cambia il numero in attesa.
  const [pendingList, setPendingList] = useState<PendingChange[]>([])
  useEffect(() => {
    if (!userId || offline.pending === 0) {
      setPendingList([])
      return
    }
    let alive = true
    void listPendingChanges(userId).then((list) => { if (alive) setPendingList(list) }).catch(() => {})
    return () => { alive = false }
  }, [userId, offline.pending])

  function toggleSection(id: SectionId) {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const geminiActive = integrations?.some((item) => item.provider === 'gemini') ?? false
  const themeLabel = THEME_OPTIONS.find((option) => option.value === setting)?.label ?? 'Sistema'
  const pushSummary = pushOn ? 'Attive' : permission === 'denied' ? 'Bloccate' : 'Spente'
  const offlineSummary = offline.pending > 0 ? `${offline.pending} in attesa` : offline.online ? 'Sincronizzato' : 'Offline'

  return (
    <div>
      <PageHeader narrow title="Impostazioni" subtitle="Tocca una sezione per aprirla" />

      <div className="page-content settings-layout mx-auto w-full max-w-[720px] px-5 pt-2 lg:px-10">
        {/* Scorciatoie verso le pagine secondarie */}
        <nav aria-label="Vai a" className="mb-4">
          <p className="mb-1 text-[13px] font-semibold text-muted">Vai a</p>
          {[
            { to: '/assistente', label: 'Assistente', icon: Bot },
            { to: '/carburanti', label: 'Carburanti', icon: Fuel },
            { to: '/guida', label: 'Guida', icon: BookOpen },
          ].map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex min-h-[52px] items-center gap-3.5 border-b border-line">
              <Icon className="h-[22px] w-[22px] text-brand" strokeWidth={1.9} aria-hidden="true" />
              <span className="flex-1 text-[15px] font-medium">{label}</span>
              <ChevronRight className="h-4 w-4 text-muted" strokeWidth={1.9} aria-hidden="true" />
            </Link>
          ))}
        </nav>

        <SettingsSection id="account" icon={CircleUser} title="Account" summary={session?.user.email ?? ''} open={open.has('account')} onToggle={toggleSection}>
          <p className="break-all text-[15px]">{session?.user.email}</p>
          <p className="mt-1 text-[13px] text-muted">Account personale · accesso su invito</p>

          <div className="mt-5">
            <p className="flex items-center gap-2 text-[15px] font-medium">
              <Fingerprint className="h-[18px] w-[18px] text-brand" strokeWidth={1.9} /> Passkey e Face ID
            </p>
            <p className="mt-1 text-[13px] leading-[1.55] text-muted">
              Accedi senza password: la passkey usa Face ID, l’impronta o il PIN e resta sul tuo dispositivo o nel portachiavi iCloud.
            </p>
            {!passkeySupported() ? (
              <p className="mt-2 text-[13px] text-muted">Questo browser non supporta le passkey.</p>
            ) : (
              <>
                {passkeys.length > 0 && (
                  <ul className="mt-2">
                    {passkeys.map((p) => (
                      <li key={p.id} className="flex min-h-[52px] items-center gap-3 border-b border-line">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px]">{p.friendly_name || 'Passkey'}</span>
                          <span className="block text-[13px] text-muted">
                            creata il {new Date(p.created_at).toLocaleDateString('it-IT')}
                            {p.last_used_at ? ` · ultimo uso ${new Date(p.last_used_at).toLocaleDateString('it-IT')}` : ''}
                          </span>
                        </span>
                        <button
                          onClick={() => void removePasskey(p)}
                          disabled={passkeyBusy}
                          aria-label={`Elimina passkey ${p.friendly_name ?? ''}`}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-expense disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={() => void addPasskey()}
                  disabled={passkeyBusy}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium disabled:opacity-60"
                >
                  {passkeyBusy ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  Crea una passkey su questo dispositivo
                </button>
              </>
            )}
            {passkeyMsg && <p className="mt-3 rounded-xl bg-card-2 px-3 py-2.5 text-[13px]">{passkeyMsg}</p>}
          </div>

        </SettingsSection>

        {owner && (
          <SettingsSection id="ospite" icon={UserPlus} title="Ospite" summary={guestSummary} open={open.has('ospite')} onToggle={toggleSection}>
            <InvitesPanel onSummary={setGuestSummary} />
          </SettingsSection>
        )}

        <SettingsSection
          id="chiavi"
          icon={KeyRound}
          title="Chiavi e integrazioni"
          summary={integrations === null ? '' : geminiActive ? 'Gemini attiva' : 'Da configurare'}
          open={open.has('chiavi')}
          onToggle={toggleSection}
        >
          <IntegrationsPanel onStatus={setIntegrations} />
          <p className="mt-4 flex gap-2 text-[13px] leading-[1.55] text-muted">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.9} />
            Analisi di documenti, voce e riassunti usano la tua chiave Gemini personale. La chiave viene inviata al server al salvataggio, cifrata e usata solo per il tuo account; non viene restituita all’app.
          </p>
        </SettingsSection>

        <SettingsSection id="aspetto" icon={Palette} title="Aspetto" summary={themeLabel} open={open.has('aspetto')} onToggle={toggleSection}>
          <Segmented
            label="Tema"
            value={setting}
            onChange={setSetting}
            options={THEME_OPTIONS.map(({ value, label }) => ({ value, label }))}
          />
        </SettingsSection>

        <SettingsSection id="notifiche" icon={Bell} title="Notifiche" summary={pushSummary} open={open.has('notifiche')} onToggle={toggleSection}>
          {!pushSupported() ? (
            <p className="text-[13px] text-muted">Questo browser non supporta le notifiche push.</p>
          ) : needsInstallForPush() ? (
            <div className="flex min-h-[52px] items-center gap-3">
              <p className="min-w-0 flex-1 text-[15px]">Su iPhone funzionano solo con AJE installata sulla schermata Home</p>
              <Link to="/guida?q=install" className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-line px-4 text-sm font-medium">
                Come fare
              </Link>
            </div>
          ) : permission === 'denied' && !pushOn ? (
            <div className="flex min-h-[52px] items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">Promemoria delle attività</span>
                <span className="block text-[13px] text-muted">Riattivale dalle impostazioni del browser</span>
              </span>
              <span className="shrink-0 rounded-[10px] bg-expense/14 px-2 py-1 text-xs font-semibold text-expense">Bloccate</span>
            </div>
          ) : (
            <div className="flex min-h-[52px] items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">Promemoria delle attività</span>
                <span className="block text-[13px] text-muted">Un avviso quando un’attività dell’agenda è in scadenza</span>
              </span>
              {pushBusy ? <Spinner className="h-5 w-5" /> : (
                <Switch checked={pushOn} onChange={() => void togglePush()} label="Attiva o disattiva le notifiche" disabled={pushBusy} />
              )}
            </div>
          )}
          {pushOn && (
            <button
              onClick={() => void testPush()}
              disabled={testBusy}
              className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium disabled:opacity-60"
            >
              {testBusy ? <Spinner className="h-4 w-4" /> : <Bell className="h-4 w-4" strokeWidth={1.9} />}
              Invia notifica di prova
            </button>
          )}
          {pushMsg && <p className="mt-3 rounded-xl bg-card-2 px-3 py-2.5 text-[13px]">{pushMsg}</p>}
        </SettingsSection>

        <SettingsSection
          id="offline"
          icon={RefreshCw}
          title="Offline"
          summary={offlineSummary}
          summaryTone={offline.pending > 0 ? 'text-warning' : undefined}
          open={open.has('offline')}
          onToggle={toggleSection}
        >
          <div className="flex min-h-[52px] items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px]">{offline.pending > 0 ? `${offline.pending} ${offline.pending === 1 ? 'modifica' : 'modifiche'} in attesa` : 'Tutto sincronizzato'}</span>
              <span className="block text-[13px] text-muted">{offline.online ? 'Connessione attiva' : 'Nessuna connessione: le modifiche restano in coda'}</span>
            </span>
            {offline.online && offline.pending > 0 && (
              <button
                onClick={() => void syncOffline(userId)}
                disabled={offline.syncing}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium disabled:opacity-60"
              >
                {offline.syncing ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" strokeWidth={1.9} />} Sincronizza
              </button>
            )}
          </div>
          {pendingList.length > 0 && (
            <>
              <ul className="mt-1">
                {pendingList.map((change) => (
                  <li key={change.id} className="flex min-h-11 items-center gap-2.5 border-b border-line text-sm">
                    <Clock className="h-4 w-4 shrink-0 text-warning" strokeWidth={1.9} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{change.label}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {new Date(change.createdAt).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 rounded-[14px] bg-warn-bg px-3.5 py-2.5 text-[13px] leading-[1.5] text-warn-text">
                Non cancellare i dati del sito né disinstallare AJE finché queste modifiche non sono sincronizzate: esistono solo su questo dispositivo.
              </p>
            </>
          )}
          <p className="mt-2 flex gap-2 text-[13px] leading-[1.55] text-muted">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} />
            Le ultime viste di Finanze e Agenda sono cifrate sul dispositivo. Senza rete puoi consultarle e modificare movimenti o attività; AJE sincronizza la coda appena torni online. Token, documenti e allegati non vengono duplicati nella cache offline.
          </p>
        </SettingsSection>

        <button
          onClick={() => {
            setLogoutError('')
            void signOutEverywhere().then((ok) => { if (!ok) setLogoutError('Uscita non riuscita. Controlla la connessione e riprova.') })
          }}
          className="flex min-h-16 w-full items-center gap-3.5 border-b border-line text-left text-base font-medium text-expense"
        >
          <LogOut className="h-[22px] w-[22px]" strokeWidth={1.9} aria-hidden="true" /> Esci
        </button>
        {logoutError && <p role="alert" className="mt-2 text-sm text-expense">{logoutError}</p>}

        <p className="py-6 text-center text-xs text-muted">
          AJE · v1.0
          <br />
          Account personali · Accesso su invito
        </p>
      </div>
    </div>
  )
}

type SectionId = 'account' | 'ospite' | 'chiavi' | 'aspetto' | 'notifiche' | 'offline'

/** Sezione a fisarmonica: il contenuto resta montato e si apre con altezza e opacità. */
function SettingsSection({
  id,
  icon: Icon,
  title,
  summary,
  summaryTone,
  open,
  onToggle,
  children,
}: {
  id: SectionId
  icon: typeof Bell
  title: string
  summary: string
  summaryTone?: string
  open: boolean
  onToggle: (id: SectionId) => void
  children: ReactNode
}) {
  const panelId = `settings-${id}`
  return (
    <section className="border-b border-line">
      <h2>
        <button
          type="button"
          onClick={() => onToggle(id)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-16 w-full items-center gap-3.5 text-left"
        >
          <Icon className="h-[22px] w-[22px] shrink-0 text-brand" strokeWidth={1.9} aria-hidden="true" />
          <span className="flex-1 text-base font-medium">{title}</span>
          <span className={`max-w-[45%] truncate text-[13px] ${summaryTone ?? 'text-muted'}`}>{summary}</span>
          <ChevronDown
            className={`settings-chevron h-5 w-5 shrink-0 text-muted ${open ? 'rotate-180' : ''}`}
            strokeWidth={1.9}
            aria-hidden="true"
          />
        </button>
      </h2>
      <div id={panelId} className="settings-panel" data-open={open} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="pb-5 pl-9">{children}</div>
        </div>
      </div>
    </section>
  )
}
