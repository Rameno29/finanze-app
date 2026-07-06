import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from './config'

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
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void }
        }
      }
    }
  }
}

const STORAGE_KEY = 'google_token'

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
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const { token, expiry } = JSON.parse(raw)
    if (Date.now() > expiry) return null
    return token
  } catch {
    return null
  }
}

/** Richiede un access token a Google (apre il popup solo se necessario). */
export async function requestGoogleToken(interactive: boolean): Promise<string> {
  await loadGisScript()
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? 'Autorizzazione negata'))
          return
        }
        sessionStorage.setItem(
          STORAGE_KEY,
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
  sessionStorage.removeItem(STORAGE_KEY)
}

export async function googleFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Google API ${res.status}`)
  return (await res.json()) as T
}
