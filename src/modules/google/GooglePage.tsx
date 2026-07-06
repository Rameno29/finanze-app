import { useEffect, useState, type FormEvent } from 'react'
import {
  CalendarDays,
  ExternalLink,
  FileText,
  LogOut,
  Mail,
  MapPin,
  Navigation,
} from 'lucide-react'
import { GOOGLE_CLIENT_ID } from '../../lib/config'
import {
  disconnectGoogle,
  getStoredGoogleToken,
  googleFetch,
  requestGoogleToken,
} from '../../lib/googleAuth'
import { Card, PageHeader, PrimaryButton, Spinner, inputClass } from '../../components/ui'

interface CalEvent {
  id: string
  summary?: string
  htmlLink: string
  start: { dateTime?: string; date?: string }
}
interface GmailMessage {
  id: string
  subject: string
  from: string
}
interface DriveFile {
  id: string
  name: string
  webViewLink?: string
}

function formatEventStart(e: CalEvent): string {
  if (e.start.dateTime) {
    return new Date(e.start.dateTime).toLocaleString('it-IT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  if (e.start.date) {
    return new Date(e.start.date + 'T00:00:00').toLocaleDateString('it-IT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  }
  return ''
}

export function GooglePage() {
  const configured = GOOGLE_CLIENT_ID !== ''
  const [token, setToken] = useState<string | null>(getStoredGoogleToken())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [events, setEvents] = useState<CalEvent[] | null>(null)
  const [emails, setEmails] = useState<GmailMessage[] | null>(null)
  const [files, setFiles] = useState<DriveFile[] | null>(null)
  const [mapsQuery, setMapsQuery] = useState('')

  async function connect() {
    setBusy(true)
    setError('')
    try {
      const t = await requestGoogleToken(true)
      setToken(t)
    } catch {
      setError('Collegamento non riuscito. Riprova.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function load() {
      try {
        const nowISO = new Date().toISOString()
        const [cal, mailList, drive] = await Promise.all([
          googleFetch<{ items?: CalEvent[] }>(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(nowISO)}&maxResults=5&singleEvents=true&orderBy=startTime`,
            token!,
          ),
          googleFetch<{ messages?: Array<{ id: string }> }>(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is%3Aunread%20in%3Ainbox&maxResults=5',
            token!,
          ),
          googleFetch<{ files?: DriveFile[] }>(
            'https://www.googleapis.com/drive/v3/files?orderBy=viewedByMeTime%20desc&pageSize=6&fields=files(id,name,webViewLink)',
            token!,
          ),
        ])
        const mails: GmailMessage[] = []
        for (const m of mailList.messages ?? []) {
          const detail = await googleFetch<{
            payload?: { headers?: Array<{ name: string; value: string }> }
          }>(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
            token!,
          )
          const headers = detail.payload?.headers ?? []
          mails.push({
            id: m.id,
            subject: headers.find((h) => h.name === 'Subject')?.value ?? '(senza oggetto)',
            from: (headers.find((h) => h.name === 'From')?.value ?? '').replace(/<.*>/, '').trim(),
          })
        }
        if (!cancelled) {
          setEvents(cal.items ?? [])
          setEmails(mails)
          setFiles(drive.files ?? [])
        }
      } catch {
        if (!cancelled) {
          setError('Sessione Google scaduta o permessi mancanti: ricollega l’account.')
          disconnectGoogle()
          setToken(null)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  function openMaps(e: FormEvent) {
    e.preventDefault()
    if (!mapsQuery.trim()) return
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery.trim())}`,
      '_blank',
    )
  }

  return (
    <div className="pb-28">
      <PageHeader title="Google" subtitle="Calendar, Gmail, Drive e Maps" />

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-5 pt-4">
        {/* Maps funziona sempre, senza collegamento */}
        <Card>
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <MapPin className="h-4 w-4 text-accent" /> Maps
          </h2>
          <form onSubmit={openMaps} className="flex gap-2">
            <input
              value={mapsQuery}
              onChange={(e) => setMapsQuery(e.target.value)}
              className={inputClass}
              placeholder="Cerca un posto o un indirizzo…"
            />
            <button
              type="submit"
              aria-label="Apri in Maps"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-white"
            >
              <Navigation className="h-5 w-5" />
            </button>
          </form>
        </Card>

        {!configured ? (
          <Card>
            <h2 className="mb-2 font-semibold">Collega il tuo account Google</h2>
            <p className="text-sm text-muted">
              Per vedere qui calendario, email e file serve un ultimo passaggio di configurazione
              (gratuito): la creazione del progetto Google Cloud. Segui la guida che ti ha dato
              Claude e la funzione si attiverà.
            </p>
          </Card>
        ) : !token ? (
          <Card>
            <h2 className="mb-2 font-semibold">Collega il tuo account Google</h2>
            <p className="mb-4 text-sm text-muted">
              Vedrai i prossimi eventi del calendario, le email non lette e i file recenti di
              Drive. L’app legge soltanto: non modifica né invia nulla.
            </p>
            {error && <p className="mb-3 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}
            <PrimaryButton onClick={connect} disabled={busy}>
              {busy ? <Spinner className="h-5 w-5 text-white" /> : 'Collega Google'}
            </PrimaryButton>
          </Card>
        ) : (
          <>
            <Card>
              <h2 className="mb-2 flex items-center gap-2 font-semibold">
                <CalendarDays className="h-4 w-4 text-accent" /> Prossimi eventi
              </h2>
              {events === null ? (
                <div className="flex justify-center py-4"><Spinner /></div>
              ) : events.length === 0 ? (
                <p className="py-2 text-sm text-muted">Nessun evento in programma.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {events.map((e) => (
                    <li key={e.id}>
                      <a href={e.htmlLink} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{e.summary ?? '(senza titolo)'}</span>
                          <span className="block text-xs text-muted">{formatEventStart(e)}</span>
                        </span>
                        <ExternalLink className="h-4 w-4 shrink-0 text-muted" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-2 flex items-center gap-2 font-semibold">
                <Mail className="h-4 w-4 text-accent" /> Email non lette
              </h2>
              {emails === null ? (
                <div className="flex justify-center py-4"><Spinner /></div>
              ) : emails.length === 0 ? (
                <p className="py-2 text-sm text-muted">Nessuna email non letta. 🎉</p>
              ) : (
                <ul className="divide-y divide-line">
                  {emails.map((m) => (
                    <li key={m.id}>
                      <a
                        href={`https://mail.google.com/mail/u/0/#inbox/${m.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block py-2.5"
                      >
                        <span className="block truncate font-medium">{m.subject}</span>
                        <span className="block truncate text-xs text-muted">{m.from}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-2 flex items-center gap-2 font-semibold">
                <FileText className="h-4 w-4 text-accent" /> File recenti su Drive
              </h2>
              {files === null ? (
                <div className="flex justify-center py-4"><Spinner /></div>
              ) : files.length === 0 ? (
                <p className="py-2 text-sm text-muted">Nessun file recente.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {files.map((f) => (
                    <li key={f.id}>
                      <a
                        href={f.webViewLink ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 py-2.5"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                        <ExternalLink className="h-4 w-4 shrink-0 text-muted" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <button
              onClick={() => {
                disconnectGoogle()
                setToken(null)
                setEvents(null)
                setEmails(null)
                setFiles(null)
              }}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-line font-semibold text-muted"
            >
              <LogOut className="h-5 w-5" /> Scollega Google
            </button>
          </>
        )}
      </div>
    </div>
  )
}
