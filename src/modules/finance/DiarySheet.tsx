import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Mic, Sparkles } from 'lucide-react'
import { Field, PrimaryButton, Sheet, Spinner, inputClass } from '../../components/ui'
import { invokeFunction } from '../../lib/integrations'
import { currentUserId, mutateOffline } from '../../lib/offline'
import { sessionScope } from '../../lib/sessionScope'
import { startVoiceRecording, voiceSupported, type VoiceRecorder } from '../../lib/voice'
import { formatCents, todayISO } from '../../lib/format'
import type { Account, Category, Kind } from '../../types'

interface DiaryEntry {
  amount_cents: number
  kind: Kind
  category_name: string | null
  date: string | null
  description: string
}

interface ProposedRow extends DiaryEntry {
  id: string
  index: number
  selected: boolean
  category_id: string
}

/**
 * Diario serale: detti (o scrivi) tutte le spese della giornata in una volta,
 * l'AI le separa in singoli movimenti e li salvi in blocco dopo averli controllati.
 */
export function DiarySheet({
  open,
  onClose,
  categories,
  accounts,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  categories: Category[]
  accounts: Account[]
  onSaved: () => void
}) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ProposedRow[] | null>(null)
  const [accountId, setAccountId] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState('')
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const recorderRef = useRef<VoiceRecorder | null>(null)
  const voiceAbortRef = useRef<AbortController | null>(null)
  const voiceStartingRef = useRef(false)
  const autoStopRef = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    setText('')
    setRows(null)
    setAccountId('')
    setError('')
    setSavedCount(null)
    setAttempted(false)
  }, [open])

  useEffect(() => {
    if (!open) { setListening(false);setTranscribing(false) }
    return () => {
      voiceAbortRef.current?.abort()
      if (autoStopRef.current) clearTimeout(autoStopRef.current)
      recorderRef.current?.cancel()
      recorderRef.current = null
    }
  }, [open])

  const categoriesByKind = useMemo(
    () => ({
      expense: categories.filter((c) => c.kind === 'expense'),
      income: categories.filter((c) => c.kind === 'income'),
    }),
    [categories],
  )

  async function stopRec() {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
    const rec = recorderRef.current
    recorderRef.current = null
    setListening(false)
    if (!rec) return
    setTranscribing(true)
    setError('')
    try {
      const audio = await rec.stop()
      const { data, error: fnError } = await invokeFunction('ai-command', {
        body: { audio_base64: audio.base64, audio_mime: audio.mime, transcribe_only: true },
      })
      if (fnError) throw fnError
      const transcript = ((data as { transcript?: string }).transcript ?? '').trim()
      if (transcript) setText((prev) => (prev.trim() ? `${prev.trim()}, ${transcript}` : transcript))
      else setError('Non ho sentito bene: riprova parlando con calma.')
} catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Trascrizione non riuscita, riprova tra poco.')
    } finally {
      setTranscribing(false)
    }
  }

  async function toggleMic() {
    if (listening) {
      void stopRec()
      return
    }
    if (!voiceSupported() || parsing || transcribing || voiceStartingRef.current) return
    voiceStartingRef.current = true
    const controller = new AbortController()
    voiceAbortRef.current = controller
    try {
      recorderRef.current = await startVoiceRecording(controller.signal)
      setListening(true)
      // Il diario può essere lungo: stop di sicurezza a 60 secondi.
      autoStopRef.current = window.setTimeout(() => void stopRec(), 60000)
    } catch {
      setListening(false)
      setError('Non riesco ad accedere al microfono: controlla il permesso.')
    } finally { voiceStartingRef.current = false }
  }

  async function parse() {
    const phrase = text.trim()
    if (!phrase || parsing || attempted) return
    setParsing(true)
    setError('')
    try {
      const { data, error: fnError } = await invokeFunction('ai-analyze', {
        body: { mode: 'parse_transactions', text: phrase },
      })
      if (fnError) throw fnError
      const entries = ((data as { transactions?: DiaryEntry[] }).transactions ?? []).filter(
        (entry) => entry.amount_cents > 0,
      )
      if (entries.length === 0) {
        setError('Non ho riconosciuto movimenti: prova con "caffè 1,20, pranzo 8 euro, benzina 40".')
        return
      }
      setRows(
        entries.map((entry, index) => {
          const match = entry.category_name
            ? categories.find(
                (c) => c.kind === entry.kind && c.name.toLowerCase() === entry.category_name!.toLowerCase(),
              )
            : undefined
          return { ...entry, id: crypto.randomUUID(), index, selected: true, category_id: match?.id ?? '' }
        }),
      )
} catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Non sono riuscito a interpretare il diario, riprova.')
    } finally {
      setParsing(false)
    }
  }

  function updateRow(index: number, patch: Partial<ProposedRow>) {
    setRows((prev) => prev?.map((row) => (row.index === index ? { ...row, ...patch } : row)) ?? null)
  }

  async function save() {
    if (!rows) return
    const chosen = rows.filter((row) => row.selected)
    if (chosen.length === 0) {
      setError('Seleziona almeno un movimento.')
      return
    }
    setSaving(true)
    setAttempted(true)
    setError('')
    try {
      const ticket = sessionScope.capture()
      const userId = await currentUserId()
      for (const row of chosen) {
        sessionScope.assert(ticket)
        const id = row.id
        const record = {
          id,
          user_id: userId,
          amount_cents: row.amount_cents,
          original_amount_cents: row.amount_cents,
          currency_code: 'EUR',
          exchange_rate_to_eur: 1,
          exchange_rate_date: null,
          exchange_rate_source: 'EUR',
          kind: row.kind,
          category_id: row.category_id || null,
          account_id: accountId || null,
          date: row.date ?? todayISO(),
          description: row.description.slice(0, 200),
          recurrence: null,
          transfer_group: null,
        }
        await mutateOffline('transactions', 'insert', id, record, {
          ...record,
          document_id: null,
          created_at: new Date().toISOString(),
        })
      }
      sessionScope.assert(ticket)
      setSavedCount(chosen.length)
      onSaved()
} catch (cause) {
      setError(`${cause instanceof Error ? cause.message : 'Salvataggio non riuscito.'} Riprova qui senza duplicare i movimenti già salvati. Se chiudi il diario, controlla i movimenti prima di reinserirli.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Diario del giorno">
      {savedCount !== null ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Check className="h-12 w-12 text-income" />
          <p className="font-semibold">{savedCount} movimenti registrati</p>
          <PrimaryButton onClick={onClose}>Chiudi</PrimaryButton>
        </div>
      ) : (
        <div className="pb-4">
          <p className="mb-3 text-sm text-muted">
            Racconta la giornata in una volta sola — <em>"caffè 1,20, pranzo 8 euro, benzina 40"</em> —
            a voce o scrivendo: l'AI la trasforma in movimenti separati che controlli e salvi in blocco.
          </p>

          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder={
                listening
                  ? '🔴 Registrando… tocca ✓ per fermare'
                  : transcribing
                    ? 'Trascrivo…'
                    : 'Es: caffè 1,20, pranzo con Marco 12 euro, spesa Esselunga 34,50'
              }
              disabled={listening || transcribing || attempted}
            />
            {voiceSupported() && (
              <button
                type="button"
                onClick={() => void toggleMic()}
                disabled={transcribing || parsing || attempted}
                aria-label={listening ? 'Ferma e trascrivi' : 'Detta a voce'}
                className={`flex h-12 w-12 shrink-0 items-center justify-center self-start rounded-xl transition disabled:opacity-50 ${
                  listening ? 'animate-pulse bg-expense text-white' : 'bg-card-2 text-muted'
                }`}
              >
                {transcribing ? (
                  <Spinner className="h-5 w-5" />
                ) : listening ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
            )}
          </div>

          <PrimaryButton
            onClick={() => void parse()}
            disabled={parsing || listening || transcribing || attempted || !text.trim()}
            className="mt-3"
          >
            {parsing ? (
              <Spinner className="h-5 w-5 text-white" />
            ) : (
              <>
                <Sparkles className="h-5 w-5" /> Interpreta il diario
              </>
            )}
          </PrimaryButton>

          {rows && (
            <>
              <div className="mt-4 max-h-[34vh] overflow-y-auto rounded-2xl border border-line">
                {rows.map((row) => (
                  <div
                    key={row.index}
                    className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={row.selected}
                      disabled={attempted}
                      onChange={(e) => updateRow(row.index, { selected: e.target.checked })}
                      aria-label={`Registra ${row.description || 'movimento'}`}
                      className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {row.description || '(senza descrizione)'}
                      </p>
                      <p className="text-xs text-muted">{row.date ?? todayISO()}</p>
                      <select
                        value={row.category_id}
                        disabled={attempted}
                        onChange={(e) => updateRow(row.index, { category_id: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-line bg-card-2 px-2 py-1 text-xs"
                      >
                        <option value="">Senza categoria</option>
                        {categoriesByKind[row.kind].map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-bold ${
                        row.kind === 'income' ? 'text-income' : 'text-expense'
                      }`}
                    >
                      {row.kind === 'income' ? '+' : '−'}{formatCents(row.amount_cents)}
                    </span>
                  </div>
                ))}
              </div>

              {accounts.length > 0 && (
                <Field label="Conto (per tutti i movimenti)">
                  <select
                    value={accountId}
                    disabled={attempted}
                    onChange={(e) => setAccountId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Nessun conto</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </Field>
              )}

              <PrimaryButton onClick={() => void save()} disabled={saving} className="mt-3">
                {saving ? (
                  <Spinner className="h-5 w-5 text-white" />
                ) : (
                  `Registra ${rows.filter((r) => r.selected).length} movimenti`
                )}
              </PrimaryButton>
            </>
          )}

          {error && <p className="mt-3 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}
        </div>
      )}
    </Sheet>
  )
}
