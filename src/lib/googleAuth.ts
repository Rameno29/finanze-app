import { GOOGLE_SCOPES } from './config'
import { getOAuthClientId } from './integrations'
import { scopedStorageKey, sessionScope } from './sessionScope'

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            callback: (resp: TokenResponse) => void
            error_callback: () => void
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void }
        }
      }
    }
  }
}

const storageKey = () => scopedStorageKey('google_token')

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      resolve()
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Impossibile caricare Google Sign-In'))
    document.head.appendChild(s)
  })
}

export function getStoredGoogleToken(): string | null {
  try {
    const raw = sessionStorage.getItem(storageKey())
    if (!raw) return null
    const { token, expiry } = JSON.parse(raw)
    if (typeof token !== 'string' || typeof expiry !== 'number' || Date.now() > expiry) {
      sessionStorage.removeItem(storageKey())
      return null
    }
    return token
  } catch {
    return null
  }
}

/** Richiede un access token a Google (apre il popup solo se necessario). */
export async function requestGoogleToken(interactive: boolean): Promise<string> {
  const ticket = sessionScope.capture()
  const clientId = await getOAuthClientId('google')
  await loadGisScript()
  sessionScope.assert(ticket)
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      error_callback: () => reject(new Error('Popup Google chiuso o bloccato. Consenti i popup e riprova.')),
      callback: (resp) => {
        try { sessionScope.assert(ticket) } catch (error) { reject(error); return }
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? 'Autorizzazione negata'))
          return
        }
        sessionStorage.setItem(
          storageKey(),
          JSON.stringify({
            token: resp.access_token,
            expiry: Date.now() + ((resp.expires_in ?? 3600) - 60) * 1000,
          }),
        )
        resolve(resp.access_token)
      },
    })
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' })
  })
}

export function disconnectGoogle() {
  sessionStorage.removeItem(storageKey())
}

export async function googleFetch<T>(url: string, token: string): Promise<T> {
  const ticket = sessionScope.capture()
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  sessionScope.assert(ticket)
  if (res.status === 401) { disconnectGoogle(); throw new Error('Collegamento Google scaduto. Ricollega il tuo account.') }
  if (!res.ok) throw new Error(`Google API ${res.status}`)
  return (await res.json()) as T
}
