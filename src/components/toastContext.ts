import { createContext, useContext } from 'react'

export interface ToastOptions {
  text: string
  /** Se presente, il toast mostra "Annulla" e la chiama al tocco. */
  onUndo?: () => void
}

export const ToastContext = createContext<(options: ToastOptions) => void>(() => {})

/** Mostra un messaggio di conferma globale: `toast({ text, onUndo? })`. */
export function useToast() {
  return useContext(ToastContext)
}
