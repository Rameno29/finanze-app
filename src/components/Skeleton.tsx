/** Blocco segnaposto durante il caricamento; la forma si dà con le classi (es. `h-4 w-24 rounded`). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block rounded-md ${className}`} />
}

/** Segnaposto con la forma di una riga elenco (icona tonda, due righe di testo, importo). */
export function SkeletonRow({ height = 64 }: { height?: number }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-3.5" style={{ minHeight: height }}>
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-3.5 w-16" />
    </div>
  )
}
