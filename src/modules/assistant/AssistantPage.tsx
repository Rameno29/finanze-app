import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Bot, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PageHeader, Spinner, inputClass } from '../../components/ui'

interface Message {
  role: 'user' | 'ai'
  text: string
}

const SUGGESTIONS = [
  'Quanto ho speso questo mese?',
  'Come vanno i miei budget?',
  'In cosa spendo di più?',
  'Dammi 3 consigli per risparmiare',
]

function AiText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, i) => {
        const t = line.trim()
        if (!t) return null
        if (t.startsWith('- ') || t.startsWith('* ')) {
          return (
            <p key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{t.slice(2).replace(/\*\*/g, '')}</span>
            </p>
          )
        }
        return <p key={i}>{t.replace(/\*\*/g, '')}</p>
      })}
    </div>
  )
}

export function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  async function ask(question: string) {
    const q = question.trim()
    if (!q || busy) return
    setMessages((m) => [...m, { role: 'user', text: q }])
    setInput('')
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('ai-analyze', {
        body: { mode: 'assistant', question: q },
      })
      if (error) throw error
      setMessages((m) => [...m, { role: 'ai', text: (data as { answer: string }).answer }])
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'ai', text: 'Ops, non sono riuscito a rispondere. Riprova tra qualche secondo.' },
      ])
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void ask(input)
  }

  return (
    <div className="flex min-h-dvh flex-col pb-28">
      <PageHeader title="Assistente" subtitle="Chiedi qualsiasi cosa sulle tue finanze" />

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-5 pt-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Bot className="h-8 w-8" />
            </span>
            <p className="max-w-[280px] text-sm text-muted">
              Rispondo guardando i <strong className="text-ink">tuoi</strong> movimenti, budget e
              obiettivi. Prova con:
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
            </div>
          ),
        )}

        {busy && (
          <div className="mr-6 flex items-center gap-2 self-start rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3 text-sm text-muted">
            <Spinner className="h-4 w-4" /> Sto controllando i tuoi dati…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Barra di input fissa sopra la tab bar */}
      <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-bg/95 backdrop-blur-lg">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-lg gap-2 px-5 py-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            className={inputClass}
            placeholder="Es. quanto ho speso in ristoranti?"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Invia domanda"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  )
}
