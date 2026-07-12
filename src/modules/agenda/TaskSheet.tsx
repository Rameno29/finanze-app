import { useEffect, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { currentUserId, mutateOffline } from '../../lib/offline'
import { Field, PrimaryButton, Sheet, Spinner, inputClass } from '../../components/ui'
import type { Task } from '../../types'

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
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
  }, [open, editing, defaultDate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
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
      onSaved()
      onClose()
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
      onSaved()
      onClose()
    } catch {
      setBusy(false)
      setError('Eliminazione non riuscita, riprova.')
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Modifica attività' : 'Nuova attività'}>
      <form onSubmit={handleSubmit}>
        <Field label="Cosa devi fare?">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Es. Pagare la bolletta"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data (facoltativa)">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Ora">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={!date}
              className={`${inputClass} disabled:opacity-40`}
            />
          </Field>
        </div>

        <Field label="Note (facoltative)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} min-h-[80px] resize-none`}
            placeholder="Dettagli, promemoria…"
          />
        </Field>

        {error && <p className="mb-4 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense">{error}</p>}

        <PrimaryButton type="submit" disabled={busy || !title.trim()}>
          {busy ? <Spinner className="h-5 w-5 text-white" /> : 'Salva'}
        </PrimaryButton>

        {editing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl font-semibold text-expense"
          >
            <Trash2 className="h-5 w-5" /> Elimina attività
          </button>
        )}
      </form>
    </Sheet>
  )
}
