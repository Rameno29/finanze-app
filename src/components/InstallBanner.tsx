import { useEffect } from 'react'
import { X } from 'lucide-react'
import { dismissInstall, onAppInstalled, promptInstall, useInstallState } from '../lib/install'
import { useToast } from './toastContext'

/** Banner della Home (solo mobile): Android con pulsante "Installa", iOS con le istruzioni di Safari. */
export function InstallBanner() {
  const { installed, canPrompt, ios, dismissed } = useInstallState()
  if (installed || dismissed || (!canPrompt && !ios)) return null

  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-brand-soft p-3.5 lg:hidden">
      <img
        src={`${import.meta.env.BASE_URL}aje-icon-v3.webp`}
        alt=""
        className="h-10 w-10 shrink-0 rounded-[10px]"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">Installa AJE sul telefono</p>
        <p className="mt-0.5 text-[13px] leading-[1.45] text-muted">
          {canPrompt
            ? 'Aprila a tutto schermo come un’app e ricevi i promemoria come notifiche.'
            : 'In Safari tocca Condividi e poi “Aggiungi alla schermata Home”: si apre a tutto schermo e può inviarti notifiche.'}
        </p>
      </div>
      {canPrompt && (
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="min-h-10 shrink-0 rounded-full bg-brand px-4 text-sm font-semibold text-bg"
        >
          Installa
        </button>
      )}
      <button
        type="button"
        onClick={dismissInstall}
        aria-label="Nascondi il suggerimento di installazione"
        className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted"
      >
        <X className="h-5 w-5" strokeWidth={1.9} />
      </button>
    </div>
  )
}

/** Mostra il toast "AJE installata" quando il browser conferma l'installazione. */
export function InstallWatcher() {
  const toast = useToast()
  useEffect(() => onAppInstalled(() => toast({ text: 'AJE installata' })), [toast])
  return null
}
