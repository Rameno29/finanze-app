import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, X } from 'lucide-react'
import { PageHeader } from '../../components/ui'
import { Chip } from '../../components/Chip'
import { GUIDE_CATEGORIES, GUIDE_ENTRIES, searchGuide, type GuideCategory } from './guideEntries'

/** `**testo**` → grassetto. */
function rich(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
      : part,
  )
}

export function GuidePage() {
  const [params] = useSearchParams()
  const initialQuery = params.get('q') ?? ''
  const directEntry = GUIDE_ENTRIES.find((entry) => entry.id === initialQuery)
  const [query, setQuery] = useState(directEntry ? '' : initialQuery)
  const [category, setCategory] = useState<GuideCategory | null>(null)
  const [openId, setOpenId] = useState<string | null>(directEntry?.id ?? null)
  const directRef = useRef<HTMLDivElement>(null)

  // Da un collegamento (es. Impostazioni → Notifiche → "Come fare") la voce si apre e scorre in vista.
  useEffect(() => {
    if (directEntry) directRef.current?.scrollIntoView({ block: 'center' })
  }, [directEntry])

  const results = useMemo(() => searchGuide(GUIDE_ENTRIES, query, category), [query, category])

  return (
    <div>
      <PageHeader narrow title="Guida" />

      <div className="guide-layout mx-auto w-full max-w-[720px] px-5 pt-2 lg:px-10">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" strokeWidth={1.9} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cerca nella guida"
            placeholder="Cerca: spesa, PDF, ospite…"
            className="h-12 w-full rounded-[14px] border border-line bg-card pl-11 pr-11 outline-none focus:border-accent"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Cancella ricerca"
              className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:px-0">
          <Chip selected={category === null} onClick={() => setCategory(null)}>Tutte</Chip>
          {GUIDE_CATEGORIES.map((item) => (
            <Chip key={item} selected={category === item} onClick={() => setCategory(item)}>{item}</Chip>
          ))}
        </div>

        {results.length === 0 ? (
          <p className="mt-8 text-[15px] leading-[1.55] text-muted">
            Nessun risultato per “{query}”. Prova con “spesa”, “PDF” o “offline”.
          </p>
        ) : (
          <div className="mt-3">
            {results.map((entry) => {
              const open = openId === entry.id
              const panelId = `guida-${entry.id}`
              return (
                <div key={entry.id} ref={entry.id === directEntry?.id ? directRef : undefined} className="border-b border-line">
                  <h2>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : entry.id)}
                      aria-expanded={open}
                      aria-controls={panelId}
                      className="flex min-h-[60px] w-full items-center gap-3 py-2 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium">{entry.question}</span>
                        <span className="block text-xs text-muted">{entry.category}</span>
                      </span>
                      <Plus className={`guide-plus h-5 w-5 shrink-0 text-muted ${open ? 'rotate-45' : ''}`} strokeWidth={1.9} aria-hidden="true" />
                    </button>
                  </h2>
                  <div id={panelId} className="settings-panel" data-open={open} inert={!open}>
                    <div className="min-h-0 overflow-hidden">
                      <div className="space-y-2 pb-4 text-sm leading-[1.55] text-muted">
                        {entry.answer.map((paragraph, index) => <p key={index}>{rich(paragraph)}</p>)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
