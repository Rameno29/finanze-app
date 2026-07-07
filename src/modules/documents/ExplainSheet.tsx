import { Sheet } from '../../components/ui'
import type { DocAnalysis } from '../../types'

/** Mostra la spiegazione AI di un documento generico. */
export function ExplainSheet({
  analysis,
  onClose,
}: {
  analysis: DocAnalysis | null
  onClose: () => void
}) {
  if (!analysis) return null
  return (
    <Sheet open onClose={onClose} title={analysis.title || 'Analisi documento'}>
      <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm font-medium text-accent">
        {analysis.summary}
      </p>

      {analysis.key_points && analysis.key_points.length > 0 && (
        <>
          <h3 className="mb-2 text-sm font-semibold text-muted">Punti chiave</h3>
          <ul className="mb-4 space-y-2">
            {analysis.key_points.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {p}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="mb-2 text-sm font-semibold text-muted">Spiegazione semplice</h3>
      <div className="space-y-3 pb-4 text-sm leading-relaxed">
        {analysis.explanation.split(/\n\n+/).map((par, i) => (
          <p key={i} className="whitespace-pre-line">
            {par}
          </p>
        ))}
      </div>
    </Sheet>
  )
}
