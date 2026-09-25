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

/** Segnaposto di una pagina intera mentre il suo codice si carica: titolo, riga di sintesi e righe elenco. */
export function PageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Caricamento"
      className="mx-auto w-full max-w-[1120px] px-5 pt-[calc(env(safe-area-inset-top)+16px)] lg:px-10 lg:pt-8"
    >
      <Skeleton className="h-9 w-44 rounded-lg" />
      <Skeleton className="mt-3 h-4 w-60" />
      <Skeleton className="mt-8 h-14 w-56 rounded-xl" />
      <div className="mt-8 space-y-1">
        {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
      </div>
    </div>
  )
}
