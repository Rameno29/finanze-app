import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { CATEGORY_ICONS, CategoryIcon } from '../../lib/icons'
import { Card, Field, PrimaryButton, Sheet, inputClass } from '../../components/ui'
import type { Category, Kind } from '../../types'

const COLORS = [
  '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#71717a',
]

export function CategoriesView({
  categories,
  onChanged,
}: {
  categories: Category[]
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Kind>('expense')
  const [color, setColor] = useState(COLORS[4])
  const [icon, setIcon] = useState('tag')
  const [busy, setBusy] = useState(false)

  async function addCategory() {
    if (!name.trim()) return
    setBusy(true)
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('categories').insert({
      user_id: userData.user!.id,
      name: name.trim(),
      kind,
      color,
      icon,
    })
    setBusy(false)
    setOpen(false)
    setName('')
    onChanged()
  }

  async function deleteCategory(c: Category) {
    if (!window.confirm(`Eliminare la categoria "${c.name}"? I movimenti resteranno senza categoria.`)) return
    await supabase.from('categories').delete().eq('id', c.id)
    onChanged()
  }

  const groups: Array<[string, Category[]]> = [
    ['Uscite', categories.filter((c) => c.kind === 'expense')],
    ['Entrate', categories.filter((c) => c.kind === 'income')],
  ]

  return (
    <div className="mt-4">
      {groups.map(([label, list]) => (
        <section key={label} className="mb-5">
          <h3 className="mb-2 text-sm font-semibold text-muted">{label}</h3>
          <Card className="divide-y divide-line p-0">
            {list.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: c.color }}
                >
                  <CategoryIcon icon={c.icon} className="h-4 w-4" />
                </span>
                <span className="flex-1 truncate font-medium">{c.name}</span>
                <button
                  onClick={() => deleteCategory(c)}
                  aria-label={`Elimina ${c.name}`}
                  className="flex h-11 w-11 items-center justify-center text-muted"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </Card>
        </section>
      ))}

      <PrimaryButton onClick={() => setOpen(true)}>
        <Plus className="h-5 w-5" /> Nuova categoria
      </PrimaryButton>

      <Sheet open={open} onClose={() => setOpen(false)} title="Nuova categoria">
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-card-2 p-1">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`min-h-[44px] rounded-lg font-semibold transition ${
                kind === k ? 'bg-card shadow text-ink' : 'text-muted'
              }`}
            >
              {k === 'expense' ? 'Uscita' : 'Entrata'}
            </button>
          ))}
        </div>

        <Field label="Nome">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Es. Palestra"
          />
        </Field>

        <Field label="Icona">
          <div className="grid grid-cols-6 gap-2">
            {Object.keys(CATEGORY_ICONS).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                className={`flex h-11 items-center justify-center rounded-xl border ${
                  icon === key ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-card-2 text-muted'
                }`}
              >
                <CategoryIcon icon={key} className="h-5 w-5" />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Colore">
          <div className="grid grid-cols-7 gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Colore ${c}`}
                className={`h-9 w-9 rounded-full border-2 ${color === c ? 'border-ink' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>

        <PrimaryButton onClick={addCategory} disabled={busy || !name.trim()}>
          Crea categoria
        </PrimaryButton>
      </Sheet>
    </div>
  )
}
