import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { Bell, Trash2 } from 'lucide-react'
import { currentUserId, mutateOffline } from '../../lib/offline'
import { getPushSubscription } from '../../lib/push'
import { todayISO } from '../../lib/format'
import { addDaysIso, nextSaturday, whenLabel } from '../../lib/agenda'
import { shortDay } from '../../lib/home'
import { Sheet, Spinner } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import type { Task } from '../../types'

const TIMES = ['09:00', '15:30', '20:00']

function chipClass(selected: boolean, disabled = false) {
  return `relative inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors duration-[250ms] ${
    selected ? 'border-ink bg-ink text-bg' : 'border-line text-ink'
  } ${disabled ? 'pointer-events-none opacity-40' : ''}`
}

function ChoiceChip({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={selected} disabled={disabled} onClick={onClick} className={chipClass(selected, disabled)}>
      {children}
    </button>
  )
}

export function TaskSheet({
  open,
  onClose,
  onSaved,
  editing,
  defaultDate,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editing: Task | null
  defaultDate: string | null
}) {
  const toast = useToast()
  const titleId = useId()
  const formId = useId()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [titleError, setTitleError] = useState(0)
  const [pushOn, setPushOn] = useState(false)
  const today = todayISO()
  const tomorrow = addDaysIso(today, 1)
  // Di venerdì il prossimo sabato è già "Domani": si propone quello della settimana dopo.
  const saturday = nextSaturday(today) === tomorrow ? addDaysIso(tomorrow, 7) : nextSaturday(today)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setTitle(editing.title)
      setDate(editing.due_date ?? '')
      setTime(editing.due_time?.slice(0, 5) ?? '')
      setNotes(editing.notes)
    } else {
      setTitle('')
      setDate(defaultDate ?? '')
      setTime('')
      setNotes('')
    }
    setError('')
    setTitleError(0)
  }, [open, editing, defaultDate])

  useEffect(() => {
    if (!open) return
    let alive = true
    void getPushSubscription()
      .then((subscription) => { if (alive) setPushOn(subscription !== null) })
      .catch(() => { if (alive) setPushOn(false) })
    return () => { alive = false }
  }, [open])

  const quickDates = [today, tomorrow, saturday]
  const customDate = date !== '' && !quickDates.includes(date)
  const customTime = time !== '' && !TIMES.includes(time)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!title.trim()) {
      setTitleError((count) => count + 1)
      return
    }
    setBusy(true)
    try {
      const userId = await currentUserId()
      const values = {
        title: title.trim(),
        notes: notes.trim(),
        due_date: date || null,
        due_time: date && time ? time : null,
        // se cambia la scadenza, la notifica va rimandata
        notified: false,
      }
      const recordId = editing?.id ?? crypto.randomUUID()
      const insertPayload = { id: recordId, ...values, user_id: userId, done: false }
      await mutateOffline(
        'tasks', editing ? 'update' : 'insert', recordId,
        editing ? values : insertPayload,
        {
          ...(editing ?? {}), ...insertPayload,
          created_at: editing?.created_at ?? new Date().toISOString(),
        },
      )
      onClose()
      onSaved()
      toast({ text: editing ? 'Attività aggiornata' : `Attività aggiunta: ${whenLabel(values.due_date, today)}` })
    } catch {
      setError('Errore durante il salvataggio, riprova.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm('Eliminare questa attività?')) return
    setBusy(true)
    try {
      await mutateOffline('tasks', 'delete', editing.id, {}, null)
      setBusy(false)
      onClose()
      onSaved()
      toast({ text: 'Attività eliminata' })
    } catch {
      setBusy(false)
      setError('Eliminazione non riuscita, riprova.')
    }
  }

  const footer = (
    <div className="flex flex-col gap-2">
      <button
        type="submit"
        form={formId}
        disabled={busy}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-accent text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? <Spinner className="h-5 w-5 text-white" /> : editing ? 'Salva modifiche' : 'Aggiungi all’agenda'}
      </button>
      {editing && (
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={busy}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] font-semibold text-expense"
        >
          <Trash2 className="h-5 w-5" /> Elimina attività
        </button>
      )}
    </div>
  )

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Modifica attività' : 'Nuova attività'} footer={footer}>
      <form id={formId} onSubmit={handleSubmit} noValidate>
        <input
          key={titleError}
          id={titleId}
          aria-label="Cosa devi fare?"
          aria-invalid={titleError > 0 && !title.trim() ? true : undefined}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          autoFocus={titleError > 0}
          className={`h-14 w-full rounded-[14px] border bg-card px-4 text-[18px] font-medium outline-none focus:border-accent ${
            titleError > 0 && !title.trim() ? 'amount-shake border-expense' : 'border-line'
          }`}
          placeholder="Cosa devi fare?"
        />
        {titleError > 0 && !title.trim() && (
          <p role="alert" className="mt-1.5 text-[13px] text-expense">Scrivi cosa devi fare.</p>
        )}

        <div role="group" aria-label="Quando" className="mt-5">
          <p className="mb-2 text-sm font-medium text-muted">Quando</p>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            <ChoiceChip selected={date === today} onClick={() => setDate(today)}>Oggi</ChoiceChip>
            <ChoiceChip selected={date === tomorrow} onClick={() => setDate(tomorrow)}>Domani</ChoiceChip>
            <ChoiceChip selected={date === saturday} onClick={() => setDate(saturday)}>Sabato {Number(saturday.slice(8))}</ChoiceChip>
            <ChoiceChip selected={date === ''} onClick={() => { setDate(''); setTime('') }}>Senza data</ChoiceChip>
            <label className={chipClass(customDate)}>
              {customDate ? shortDay(date) : 'Altra data'}
              <input
                type="date"
                aria-label="Scegli una data"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onClick={(e) => { try { e.currentTarget.showPicker?.() } catch { /* selettore del browser */ } }}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>

        <div role="group" aria-label="Orario" className="mt-5">
          <p className="mb-2 text-sm font-medium text-muted">Orario</p>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            <ChoiceChip selected={time === ''} disabled={!date} onClick={() => setTime('')}>Nessun orario</ChoiceChip>
            {TIMES.map((value) => (
              <ChoiceChip key={value} selected={time === value} disabled={!date} onClick={() => setTime(value)}>{value}</ChoiceChip>
            ))}
            <label className={chipClass(customTime, !date)}>
              {customTime ? time : 'Altro orario'}
              <input
                type="time"
                aria-label="Scegli un orario"
                value={time}
                disabled={!date}
                onChange={(e) => setTime(e.target.value)}
                onClick={(e) => { try { e.currentTarget.showPicker?.() } catch { /* selettore del browser */ } }}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
          {!date && <p className="mt-1.5 text-[13px] text-muted">Scegli prima una data per impostare l’orario.</p>}
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-medium text-muted">Note (facoltative)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[80px] w-full resize-none rounded-[14px] border border-line bg-card px-4 py-3 outline-none focus:border-accent"
            placeholder="Dettagli, promemoria…"
          />
        </label>

        {pushOn && date && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
            <Bell className="h-4 w-4 shrink-0" strokeWidth={1.9} /> Ti avviso con una notifica il giorno stesso
          </p>
        )}

        {error && <p role="alert" className="mt-3 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}
      </form>
    </Sheet>
  )
}
