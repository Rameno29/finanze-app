import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Bot, Check, Mic, Send, X } from 'lucide-react'
import { requireUserId, supabase } from '../../lib/supabase'
import { formatCents, todayISO } from '../../lib/format'
import { startVoiceRecording, voiceSupported, type VoiceRecorder } from '../../lib/voice'
import { AiText } from '../../components/AiText'
import { PageHeader, Spinner, inputClass } from '../../components/ui'

interface TransactionData {
  amount_cents: number
  kind: 'income' | 'expense'
  category_name: string | null
  date: string | null
  description: string
  recurrence: string | null
}
interface TaskData {
  title: string
  due_date: string | null
  due_time: string | null
}
interface GoalData {
  name: string
  target_cents: number
  deadline: string | null
}
interface ContributeData {
  goal_name: string
  amount_cents: number
  direction: 'add' | 'remove'
}
interface BudgetData {
  category_name: string
  monthly_cents: number
}

type Intent =
  | { action: 'add_transaction'; say: string; data: TransactionData }
  | { action: 'add_task'; say: string; data: TaskData }
  | { action: 'add_goal'; say: string; data: GoalData }
  | { action: 'contribute_goal'; say: string; data: ContributeData }
  | { action: 'set_budget'; say: string; data: BudgetData }

interface Message {
  role: 'user' | 'ai'
  text: string
  intent?: Intent
  status?: 'pending' | 'done' | 'cancelled'
}

const SUGGESTIONS = [
  'Ho speso 12 euro di pranzo',
  'Ricordami di pagare la bolletta venerdì alle 18',
  'Quanto ho speso questo mese?',
  'Metti 50 euro nelle vacanze',
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
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<VoiceRecorder | null>(null)
  const autoStopRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current)
    recorderRef.current?.cancel()
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

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
      const { data: cmd, error: cmdErr } = await supabase.functions.invoke('ai-command', {
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
      const { data, error } = await supabase.functions.invoke('ai-analyze', {
        body: { mode: 'assistant', question: q },
      })
      if (error) throw error
      pushAi((data as { answer: string }).answer)
    } catch {
      pushAi('Ops, non sono riuscito a elaborare la richiesta. Riprova tra qualche secondo.')
    } finally {
      setBusy(false)
    }
  }

  const ask = (question: string) => void submitText(question)

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
      const { data, error } = await supabase.functions.invoke('ai-command', {
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
    } catch {
      pushAi('Trascrizione non riuscita, riprova tra poco.')
    } finally {
      setTranscribing(false)
    }
  }

  async function toggleMic() {
    if (recording) {
      void stopRecording()
      return
    }
    if (!voiceSupported() || busy || transcribing) return
    try {
      recorderRef.current = await startVoiceRecording()
      setRecording(true)
      autoStopRef.current = window.setTimeout(() => void stopRecording(), 30000)
    } catch {
      setRecording(false)
      pushAi('Non riesco ad accedere al microfono: controlla di aver dato il permesso ad AJE.')
    }
  }

  /** Esegue l'azione confermata scrivendo sul database */
  async function executeIntent(intent: Intent): Promise<string> {
    const userId = await requireUserId()

    if (intent.action === 'add_transaction') {
      const d = intent.data
      let categoryId: string | null = null
      if (d.category_name) {
        const { data: cat } = await supabase
          .from('categories')
          .select('id')
          .eq('kind', d.kind)
          .ilike('name', d.category_name)
          .maybeSingle()
        categoryId = cat?.id ?? null
      }
      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        amount_cents: d.amount_cents,
        kind: d.kind,
        category_id: categoryId,
        date: d.date ?? todayISO(),
        description: d.description,
        recurrence: d.recurrence,
      })
      if (error) throw error
      return `✅ ${d.kind === 'income' ? 'Entrata' : 'Uscita'} di ${formatCents(d.amount_cents)} registrata.`
    }

    if (intent.action === 'add_task') {
      const d = intent.data
      const { error } = await supabase.from('tasks').insert({
        user_id: userId,
        title: d.title,
        due_date: d.due_date,
        due_time: d.due_time,
      })
      if (error) throw error
      return `✅ Promemoria "${d.title}" aggiunto all'agenda.`
    }

    if (intent.action === 'add_goal') {
      const d = intent.data
      const { error } = await supabase.from('goals').insert({
        user_id: userId,
        name: d.name,
        target_cents: d.target_cents,
        deadline: d.deadline,
      })
      if (error) throw error
      return `✅ Obiettivo "${d.name}" creato (traguardo ${formatCents(d.target_cents)}).`
    }

    if (intent.action === 'contribute_goal') {
      const d = intent.data
      const { data: goals, error: goalsError } = await supabase.from('goals').select('id, name, saved_cents')
      if (goalsError) throw goalsError
      const goal = (goals ?? []).find(
        (g) =>
          g.name.toLowerCase() === d.goal_name.toLowerCase() ||
          g.name.toLowerCase().includes(d.goal_name.toLowerCase()) ||
          d.goal_name.toLowerCase().includes(g.name.toLowerCase()),
      )
      if (!goal) throw new Error(`Obiettivo "${d.goal_name}" non trovato`)
      const newSaved = Math.max(
        0,
        goal.saved_cents + (d.direction === 'remove' ? -d.amount_cents : d.amount_cents),
      )
      const { data: updated, error } = await supabase
        .from('goals')
        .update({ saved_cents: newSaved })
        .eq('id', goal.id)
        .eq('saved_cents', goal.saved_cents)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!updated) throw new Error('l’obiettivo è stato modificato nel frattempo; riprova')
      return `✅ Obiettivo "${goal.name}" aggiornato: ora ha ${formatCents(newSaved)}.`
    }

    // set_budget
    const d = intent.data
    const { data: cat } = await supabase
      .from('categories')
      .select('id, name')
      .eq('kind', 'expense')
      .ilike('name', d.category_name)
      .maybeSingle()
    if (!cat) throw new Error(`Categoria "${d.category_name}" non trovata`)
    const { error } = await supabase
      .from('budgets')
      .upsert(
        { user_id: userId, category_id: cat.id, monthly_cents: d.monthly_cents },
        { onConflict: 'user_id,category_id' },
      )
    if (error) throw error
    return `✅ Budget di ${cat.name} impostato a ${formatCents(d.monthly_cents)} al mese.`
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
    <div className="flex min-h-dvh flex-col pb-28">
      <PageHeader title="Assistente" subtitle="Parla o scrivi: domande e comandi" />

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-5 pt-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Bot className="h-8 w-8" />
            </span>
            <p className="max-w-[300px] text-sm text-muted">
              Posso <strong className="text-ink">rispondere</strong> sulle tue finanze e{' '}
              <strong className="text-ink">agire</strong> per te: registrare spese ed entrate,
              creare promemoria, obiettivi e budget. Prima di fare qualsiasi cosa ti chiedo
              conferma. Prova:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void ask(s)}
                  className="rounded-full border border-line bg-card px-4 py-2 text-sm font-medium transition active:scale-95"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="ml-10 self-end rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-white">
              {m.text}
            </div>
          ) : (
            <div
              key={i}
              className="mr-6 self-start rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3 text-sm leading-relaxed"
            >
              <AiText text={m.text} />
              {m.intent && (
                <div className="mt-3 rounded-xl bg-card-2 p-3">
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
                        className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-line font-semibold text-muted"
                      >
                        <X className="h-4 w-4" /> Annulla
                      </button>
                      <button
                        onClick={() => void confirmIntent(i, true)}
                        disabled={busy}
                        className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-income font-semibold text-white transition active:scale-[0.98]"
                      >
                        <Check className="h-4 w-4" /> Conferma
                      </button>
                    </div>
                  )}
                  {m.status === 'done' && (
                    <p className="mt-2 text-xs font-semibold text-income">Eseguito ✓</p>
                  )}
                  {m.status === 'cancelled' && (
                    <p className="mt-2 text-xs font-semibold text-muted">Annullato</p>
                  )}
                </div>
              )}
            </div>
          ),
        )}

        {busy && (
          <div className="mr-6 flex items-center gap-2 self-start rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3 text-sm text-muted">
            <Spinner className="h-4 w-4" /> Un attimo…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Barra di input fissa sopra la tab bar */}
      <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-bg/95 backdrop-blur-lg">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-lg gap-2 px-5 py-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={300}
            className={inputClass}
            placeholder={
              recording
                ? '🔴 Registrando… tocca ✓ per fermare'
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
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-50 ${
                recording ? 'animate-pulse bg-expense text-white' : 'bg-card-2 text-muted'
              }`}
            >
              {transcribing ? (
                <Spinner className="h-5 w-5" />
              ) : recording ? (
                <Check className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>
          )}
          <button
            type="submit"
            disabled={busy || recording || transcribing || !input.trim()}
            aria-label="Invia"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  )
}
