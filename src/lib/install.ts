import { useSyncExternalStore } from 'react'

/** Evento non standard di Chrome/Edge/Android: permette di mostrare il prompt di installazione quando lo decidiamo noi. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'aje-install-dismissed'
export const DISMISS_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export interface InstallState {
  /** App già aperta come installata (schermata Home / finestra propria). */
  installed: boolean
  /** Il browser offre il prompt (Android/Chrome e desktop). */
  canPrompt: boolean
  /** Safari su iPhone/iPad: niente prompt, solo le istruzioni. */
  ios: boolean
  /** Banner chiuso negli ultimi 30 giorni. */
  dismissed: boolean
}

type Listener = () => void

let deferred: BeforeInstallPromptEvent | null = null
let installedNow = false
const listeners = new Set<Listener>()
const installedListeners = new Set<Listener>()
let snapshot: InstallState | null = null

/** Chiusura ancora valida? (pura, per i test) */
export function dismissalActive(dismissedAt: number | null, now: number): boolean {
  return dismissedAt !== null && Number.isFinite(dismissedAt) && now - dismissedAt < DISMISS_DAYS * DAY_MS && dismissedAt <= now
}

/** iPhone/iPad (anche iPadOS che si presenta come Mac con touch). */
export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
}

function standalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

function readDismissed(): number | null {
  try {
    const value = localStorage.getItem(DISMISS_KEY)
    return value ? Number(value) : null
  } catch {
    return null
  }
}

function compute(): InstallState {
  return {
    installed: installedNow || standalone(),
    canPrompt: deferred !== null,
    ios: isIosDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0) && deferred === null,
    dismissed: dismissalActive(readDismissed(), Date.now()),
  }
}

function emit() {
  snapshot = compute()
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  // Registrato al caricamento del modulo (importato da main.tsx) per non perdere l'evento.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installedNow = true
    emit()
    for (const listener of installedListeners) listener()
  })
}

export function getInstallState(): InstallState {
  snapshot ??= compute()
  return snapshot
}

export function subscribeInstall(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Chiamata una volta quando l'app viene installata (per il toast "AJE installata"). */
export function onAppInstalled(listener: Listener): () => void {
  installedListeners.add(listener)
  return () => installedListeners.delete(listener)
}

/** Mostra il prompt nativo; restituisce true se l'utente ha accettato. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred
  if (!event) return false
  await event.prompt()
  const { outcome } = await event.userChoice
  deferred = null
  emit()
  return outcome === 'accepted'
}

/** Nasconde il suggerimento per 30 giorni. */
export function dismissInstall() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* storage non disponibile */ }
  emit()
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribeInstall, getInstallState)
}
