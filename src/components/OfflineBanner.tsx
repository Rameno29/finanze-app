import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { subscribeOfflineStatus, syncOffline, type OfflineStatus } from '../lib/offline'

export function OfflineBanner({ userId }: { userId: string }) {
  const [status, setStatus] = useState<OfflineStatus>({
    online: navigator.onLine, syncing: false, pending: 0, lastError: null,
  })

  useEffect(() => subscribeOfflineStatus(userId, setStatus), [userId])

  if (status.online && status.pending === 0 && !status.lastError) return null
  return (
    <div className={`relative z-50 px-4 py-2 text-center text-xs font-medium ${status.online ? 'bg-accent-soft text-accent' : 'bg-amber-100 text-amber-900'}`}>
      <span className="inline-flex items-center gap-2">
        {status.syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudOff className="h-3.5 w-3.5" />}
        {!status.online
          ? `Modalità offline${status.pending ? ` · ${status.pending} modifiche in attesa` : ''}`
          : status.syncing
            ? 'Sincronizzazione in corso…'
            : status.lastError
              ? `Sincronizzazione sospesa · ${status.pending} in attesa`
              : `${status.pending} modifiche da sincronizzare`}
        {status.online && status.pending > 0 && !status.syncing && (
          <button onClick={() => void syncOffline(userId)} className="underline">Riprova</button>
        )}
      </span>
    </div>
  )
}
