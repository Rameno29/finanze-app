import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { subscribeOfflineStatus, syncOffline, type OfflineStatus } from '../lib/offline'

function pendingLabel(count: number) {
  return `${count} ${count === 1 ? 'modifica' : 'modifiche'}`
}

export function OfflineBanner({ userId }: { userId: string }) {
  const [status, setStatus] = useState<OfflineStatus>({
    online: navigator.onLine, syncing: false, pending: 0, lastError: null,
  })

  useEffect(() => subscribeOfflineStatus(userId, setStatus), [userId])

  if (status.online && status.pending === 0 && !status.lastError) return null
  return (
    <>
      {/* Spazio in flusso: il banner flottante non copre intestazione e pulsante indietro */}
      <div aria-hidden="true" className="h-12" />
      <div
        role="status"
        className={`offline-banner fixed inset-x-4 top-[calc(env(safe-area-inset-top)+8px)] z-[55] mx-auto max-w-[560px] rounded-[14px] px-3.5 py-2.5 text-[13px] font-medium shadow-[var(--shadow-float)] lg:left-[280px] lg:top-4 ${
          status.online ? 'bg-accent-soft text-accent' : 'bg-warn-bg text-warn-text'
        }`}
      >
        <span className="flex items-center justify-center gap-2 text-center">
          {status.syncing ? <RefreshCw className="h-4 w-4 shrink-0 animate-spin" /> : <CloudOff className="h-4 w-4 shrink-0" />}
          {!status.online
            ? `Modalità offline${status.pending ? ` · ${pendingLabel(status.pending)} in attesa` : ''}`
            : status.syncing
              ? 'Sincronizzazione in corso…'
              : status.lastError
                ? `Sincronizzazione sospesa · ${status.pending} in attesa`
                : `${pendingLabel(status.pending)} da sincronizzare`}
          {status.online && status.pending > 0 && !status.syncing && (
            <button onClick={() => void syncOffline(userId)} className="-my-2 min-h-11 px-1 font-semibold underline underline-offset-2">Riprova</button>
          )}
        </span>
      </div>
    </>
  )
}
