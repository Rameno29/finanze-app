import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUp, Check, KeyRound, Mic, Sparkles, X } from 'lucide-react'
import { executeIntent, type Intent } from '../../lib/assistantActions'
import { callFunction, invokeFunction, type IntegrationStatus } from '../../lib/integrations'
import { formatCents } from '../../lib/format'
import { startVoiceRecording, voiceSupported, type VoiceRecorder } from '../../lib/voice'
import { AiText } from '../../components/AiText'
import { PageHeader, Spinner } from '../../components/ui'
import { Chip } from '../../components/Chip'

interface Message {
  role: 'user' | 'ai'
  text: string
  intent?: Intent
  status?: 'pending' | 'done' | 'cancelled'
}

const SUGGESTIONS = [
  'Quanto ho speso questo mese?',
  'Ho speso 12 euro di pranzo',
  'Ricordami di pagare la bolletta venerdì alle 18',
]

function formatDay(dateISO: string | null): string {
  if (!dateISO) return 'oggi'
  return new Date(dateISO + 'T00:00:00').toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
  })
}

/** Righe di dettaglio dell'azione proposta, per la card di conferma */
function intentDetails(i: Intent): Array<[string, string]> {
  switch (i.action) {
    case 'add_transaction':
      return [
        ['Tipo', i.data.kind === 'income' ? 'Entrata' : 'Uscita'],
        ['Importo', formatCents(i.data.amount_cents)],
        ['Categoria', i.data.category_name ?? '—'],
        ['Data', formatDay(i.data.date)],
        ...(i.data.description ? ([['Descrizione', i.data.description]] as Array<[string, string]>) : []),
        ...(i.data.recurrence ? ([['Ricorrenza', i.data.recurrence]] as Array<[string, string]>) : []),
      ]
    case 'add_task':
      return [
        ['Attività', i.data.title],
        ['Data', i.data.due_date ? formatDay(i.data.due_date) : 'senza data'],
        ...(i.data.due_time ? ([['Ora', i.data.due_time]] as Array<[string, string]>) : []),
      ]
    case 'add_goal':
      return [
        ['Obiettivo', i.data.name],
        ['Traguardo', formatCents(i.data.target_cents)],
        ...(i.data.deadline ? ([['Entro', formatDay(i.data.deadline)]] as Array<[string, string]>) : []),
      ]
    case 'contribute_goal':
      return [
        ['Obiettivo', i.data.goal_name],
        [i.data.direction === 'remove' ? 'Rimuovo' : 'Aggiungo', formatCents(i.data.amount_cents)],
      ]
    case 'set_budget':
      return [
        ['Categoria', i.data.category_name],
        ['Budget mensile', formatCents(i.data.monthly_cents)],
      ]
  }
}

export function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [geminiReady, setGeminiReady] = useState<boolean | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<VoiceRecorder | null>(null)
  const voiceAbortRef = useRef<AbortController | null>(null)
  const voiceStartingRef = useRef(false)
  const autoStopRef = useRef<number | null>(null)

  useEffect(() => () => {
    voiceAbortRef.current?.abort()
    if (autoStopRef.current) clearTimeout(autoStopRef.current)
    recorderRef.current?.cancel()
  }, [])

  useEffect(() => {
    // Solo quando c'è una conversazione: all'apertura la pagina resta in alto, con il titolo visibile.
    if (messages.length === 0 && !busy) return
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  // Stato della chiave personale, mostrato sotto il titolo
  useEffect(() => {
    let alive = true
    void callFunction<{ integrations: IntegrationStatus[] }>('user-credentials', { action: 'list' })
      .then((data) => { if (alive) setGeminiReady(data.integrations.some((item) => item.provider === 'gemini')) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  function pushAi(text: string) {
    setMessages((m) => [...m, { role: 'ai', text }])
  }

  /** Invia il testo (scritto o dettato e poi confermato) all'interprete. */
  async function submitText(question: string) {
    const q = question.trim()
    if (!q || busy) return
    setMessages((m) => [...m, { role: 'user', text: q }])
    setInput('')
    setBusy(true)
    try {
      const { data: cmd, error: cmdErr } = await invokeFunction('ai-command', {
        body: { text: q },
      })
      if (cmdErr) throw cmdErr
      const intent = cmd as { action: string; say?: string; data?: unknown }

      if (intent.action !== 'answer' && intent.data) {
        setMessages((m) => [
          ...m,
          {
            role: 'ai',
            text: intent.say || 'Ecco cosa ho capito: confermi?',
            intent: intent as Intent,
            status: 'pending',
          },
        ])
        return
      }

      // Non è un comando: rispondi come assistente sui dati
      const { data, error } = await invokeFunction('ai-analyze', {
        body: { mode: 'assistant', question: q },
      })
      if (error) throw error
      pushAi((data as { answer: string }).answer)
} catch (cause) {
      pushAi(cause instanceof Error ? cause.message : 'Ops, non sono riuscito a elaborare la richiesta. Riprova tra qualche secondo.')
    } finally {
      setBusy(false)
    }
  }

  const ask = (question: string) => void submitText(question)

  // Domanda arrivata dai suggerimenti della Home: si invia una volta e si toglie dalla cronologia.
  const location = useLocation()
  const navigate = useNavigate()
  const routeQuestionSent = useRef(false)
  const submitRef = useRef(submitText)
  useEffect(() => {
    submitRef.current = submitText
  })
  useEffect(() => {
    const question = (location.state as { ask?: unknown } | null)?.ask
    if (typeof question !== 'string' || routeQuestionSent.current) return
    routeQuestionSent.current = true
    navigate(location.pathname, { replace: true, state: null })
    void submitRef.current(question)
  }, [location.state, location.pathname, navigate])

  /** Ferma la registrazione, trascrive e mette il testo nel campo (modificabile). */
  async function stopRecording() {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
    const rec = recorderRef.current
    recorderRef.current = null
    setRecording(false)
    if (!rec) return
    setTranscribing(true)
    try {
      const audio = await rec.stop()
      const { data, error } = await invokeFunction('ai-command', {
        body: { audio_base64: audio.base64, audio_mime: audio.mime, transcribe_only: true },
      })
      if (error) throw error
      const transcript = ((data as { transcript?: string }).transcript ?? '').trim()
      if (transcript) {
        setInput(transcript)
        setTimeout(() => inputRef.current?.focus(), 50)
      } else {
        pushAi('Non ho sentito bene. Riprova avvicinando il microfono e parlando con calma.')
      }
} catch (cause) {
      pushAi(cause instanceof Error ? cause.message : 'Trascrizione non riuscita, riprova tra poco.')
    } finally {
      setTranscribing(false)
    }
  }

  async function toggleMic() {
    if (recording) {
      void stopRecording()
      return
    }
    if (!voiceSupported() || busy || transcribing || voiceStartingRef.current) return
    voiceStartingRef.current = true
    const controller = new AbortController()
    voiceAbortRef.current = controller
    try {
      recorderRef.current = await startVoiceRecording(controller.signal)
      setRecording(true)
      autoStopRef.current = window.setTimeout(() => void stopRecording(), 30000)
    } catch {
      setRecording(false)
      pushAi('Non riesco ad accedere al microfono: controlla di aver dato il permesso ad AJE.')
    } finally { voiceStartingRef.current = false }
  }

  async function confirmIntent(index: number, confirmed: boolean) {
    const msg = messages[index]
    if (!msg.intent || msg.status !== 'pending') return
    if (!confirmed) {
      setMessages((m) => m.map((x, i) => (i === index ? { ...x, status: 'cancelled' } : x)))
      pushAi('Va bene, annullato.')
      return
    }
    setBusy(true)
    try {
      const result = await executeIntent(msg.intent)
      setMessages((m) => m.map((x, i) => (i === index ? { ...x, status: 'done' } : x)))
      pushAi(result)
    } catch (e) {
      setMessages((m) => m.map((x, i) => (i === index ? { ...x, status: 'cancelled' } : x)))
      pushAi(`Non sono riuscito a completare l'azione${e instanceof Error && e.message ? `: ${e.message}` : ''}. Riprova.`)
    } finally {
      setBusy(false)
    }
  }


  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void submitText(input)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader
        narrow
        title="Assistente"
        subtitle={geminiReady === null ? undefined : geminiReady ? 'Gemini · chiave personale attiva' : 'Chiave Gemini non impostata'}
      />

      <div className="assistant-conversation mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-3 px-5 pb-28 pt-3 lg:px-10">
        {messages.length === 0 && geminiReady === false && (
          <div className="flex flex-col items-center py-10 text-center">
            <KeyRound className="h-9 w-9 text-accent" strokeWidth={1.9} aria-hidden="true" />
            <p className="mt-3 text-xl font-semibold">Serve la tua chiave Gemini</p>
            <p className="mt-1.5 max-w-[320px] text-sm leading-[1.55] text-muted">
              L’assistente risponde con la tua chiave personale. Aggiungila una volta nelle Impostazioni e sei pronto.
            </p>
            <Link
              to="/impostazioni#integrazioni"
              className="mt-5 flex min-h-12 items-center rounded-[16px] bg-accent px-6 text-[15px] font-semibold text-white"
            >
              Aggiungi la chiave
            </Link>
            <Link to="/guida?q=chiave" className="mt-2 flex min-h-11 items-center text-sm font-semibold text-accent">
              Come ottenerla
            </Link>
          </div>
        )}

        {messages.length === 0 && geminiReady !== false && (
          <div className="flex flex-col gap-4 py-4">
            <p className="text-[17px] leading-[1.5]">
              Chiedimi dei tuoi soldi, dei documenti o dell’agenda. Rispondo usando i tuoi dati.
            </p>
            <p className="text-[13px] text-muted">Se mi chiedi di registrare qualcosa, ti mostro cosa ho capito e aspetto la tua conferma.</p>
            <div className="flex flex-col items-start gap-2">
              {SUGGESTIONS.map((s) => (
                <Chip key={s} variant="suggestion" onClick={() => void ask(s)}>{s}</Chip>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="assistant-message max-w-[84%] self-end rounded-[20px_20px_6px_20px] bg-accent px-4 py-3 text-[15px] leading-[1.5] text-white">
              {m.text}
            </div>
          ) : (
            <div key={i} className="assistant-message max-w-[84%] self-start rounded-[20px_20px_20px_6px] bg-card-2 px-4 py-3 text-[15px] leading-[1.5]">
              <AiText text={m.text} />
              {m.intent && (
                <div className="mt-3 rounded-[14px] bg-card p-3 text-sm">
                  {intentDetails(m.intent).map(([label, value]) => (
                    <p key={label} className="flex justify-between gap-3 py-0.5">
                      <span className="text-muted">{label}</span>
                      <span className="font-medium">{value}</span>
                    </p>
                  ))}
                  {m.status === 'pending' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => void confirmIntent(i, false)}
                        disabled={busy}
                        className="flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] border border-line font-semibold text-muted"
                      >
                        <X className="h-4 w-4" /> Annulla
                      </button>
                      <button
                        onClick={() => void confirmIntent(i, true)}
                        disabled={busy}
                        className="flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] bg-accent font-semibold text-white transition active:scale-[0.98]"
                      >
                        <Check className="h-4 w-4" /> Conferma
                      </button>
                    </div>
                  )}
                  {m.status === 'done' && <p className="mt-2 text-xs font-semibold text-income">Eseguito</p>}
                  {m.status === 'cancelled' && <p className="mt-2 text-xs font-semibold text-muted">Annullato</p>}
                </div>
              )}
            </div>
          ),
        )}

        {busy && (
          <div role="status" className="assistant-message flex items-center gap-2 self-start rounded-[20px_20px_20px_6px] bg-card-2 px-4 py-3 text-sm text-muted">
            <Sparkles className="h-4 w-4 animate-pulse text-accent" strokeWidth={1.9} /> AJE sta controllando i tuoi dati…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer flottante: su questa pagina la barra di navigazione mobile è nascosta */}
      <div className="assistant-composer fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+14px)] z-30 lg:left-[calc(264px+40px)] lg:right-10">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex h-[58px] max-w-[720px] items-center gap-1 rounded-[29px] border border-line bg-card pl-5 pr-1.5 shadow-[var(--shadow-float)]"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={300}
            aria-label="Messaggio per AJE"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
            placeholder={
              recording
                ? 'Registrando… tocca ✓ per fermare'
                : transcribing
                  ? 'Trascrivo…'
                  : 'Scrivi o tocca il microfono'
            }
            disabled={recording || transcribing}
          />
          {voiceSupported() && (
            <button
              type="button"
              onClick={() => void toggleMic()}
              disabled={transcribing}
              aria-label={recording ? 'Ferma e trascrivi' : 'Parla'}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50 ${
                recording ? 'animate-pulse bg-expense text-white' : 'text-muted'
              }`}
            >
              {transcribing ? <Spinner className="h-5 w-5" /> : recording ? <Check className="h-5 w-5" /> : <Mic className="h-5 w-5" strokeWidth={1.9} />}
            </button>
          )}
          <button
            type="submit"
            disabled={busy || recording || transcribing || !input.trim()}
            aria-label="Invia"
            className={`assistant-send flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50 ${
              input.trim() ? 'scale-100' : 'scale-[.85]'
            }`}
          >
            <ArrowUp className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </form>
      </div>
    </div>
  )
}
