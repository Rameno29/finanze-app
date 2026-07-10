import { APP_URL, SPOTIFY_CLIENT_ID, SPOTIFY_SCOPES } from './config'

const TOKEN_KEY = 'spotify_token'
const VERIFIER_KEY = 'spotify_verifier'
const STATE_KEY = 'spotify_state'

interface StoredToken {
  access_token: string
  refresh_token: string
  expiry: number
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Avvia il login Spotify (flusso PKCE, senza segreti lato client). */
export async function beginSpotifyAuth(): Promise<void> {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(64))
  const verifier = base64Url(verifierBytes)
  const state = base64Url(crypto.getRandomValues(new Uint8Array(32)))
  localStorage.setItem(VERIFIER_KEY, verifier)
  localStorage.setItem(STATE_KEY, state)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = base64Url(new Uint8Array(digest))

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: APP_URL,
    scope: SPOTIFY_SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

async function tokenRequest(body: URLSearchParams): Promise<StoredToken | null> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) return null
  const data = await res.json()
  const prev = getStored()
  const stored: StoredToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? prev?.refresh_token ?? '',
    expiry: Date.now() + (data.expires_in - 60) * 1000,
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(stored))
  return stored
}

/** Da chiamare all'avvio: completa il ritorno dal login Spotify (?code=...). */
export async function handleSpotifyCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const returnedState = params.get('state')
  const verifier = localStorage.getItem(VERIFIER_KEY)
  const expectedState = localStorage.getItem(STATE_KEY)
  if (!code) return false
  if (!verifier || !expectedState || returnedState !== expectedState) {
    localStorage.removeItem(VERIFIER_KEY)
    localStorage.removeItem(STATE_KEY)
    window.history.replaceState({}, '', window.location.pathname)
    return false
  }
  localStorage.removeItem(VERIFIER_KEY)
  localStorage.removeItem(STATE_KEY)
  const stored = await tokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: APP_URL,
      client_id: SPOTIFY_CLIENT_ID,
      code_verifier: verifier,
    }),
  )
  // Pulisce l'URL dal codice
  window.history.replaceState({}, '', window.location.pathname)
  return stored !== null
}

function getStored(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<StoredToken>
    if (
      typeof value.access_token !== 'string' ||
      typeof value.refresh_token !== 'string' ||
      typeof value.expiry !== 'number' ||
      !Number.isFinite(value.expiry)
    ) return null
    return value as StoredToken
  } catch {
    return null
  }
}

export function isSpotifyConnected(): boolean {
  return getStored() !== null
}

export function disconnectSpotify() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(VERIFIER_KEY)
  localStorage.removeItem(STATE_KEY)
}

/** Token valido, rinnovato automaticamente se scaduto. */
export async function getSpotifyToken(): Promise<string | null> {
  const stored = getStored()
  if (!stored) return null
  if (Date.now() < stored.expiry) return stored.access_token
  if (!stored.refresh_token) return null
  const renewed = await tokenRequest(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: stored.refresh_token,
      client_id: SPOTIFY_CLIENT_ID,
    }),
  )
  if (!renewed) {
    disconnectSpotify()
    return null
  }
  return renewed.access_token
}

export async function spotifyFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const token = await getSpotifyToken()
  if (!token) throw new Error('Spotify non collegato')
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  })
  if (res.status === 204) return null
  if (!res.ok) throw new Error(`Spotify API ${res.status}`)
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : null
}
