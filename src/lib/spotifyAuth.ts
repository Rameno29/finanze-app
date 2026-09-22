import { APP_URL, SPOTIFY_SCOPES } from './config'
import { getOAuthClientId } from './integrations'
import { scopedStorageKey, sessionScope } from './sessionScope'

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
  const ticket = sessionScope.capture()
  const clientId = await getOAuthClientId('spotify')
  sessionScope.assert(ticket)
  const verifierBytes = crypto.getRandomValues(new Uint8Array(64))
  const verifier = base64Url(verifierBytes)
  const state = base64Url(crypto.getRandomValues(new Uint8Array(32)))
  sessionStorage.setItem(scopedStorageKey(VERIFIER_KEY), verifier)
  sessionStorage.setItem(scopedStorageKey(STATE_KEY), state)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = base64Url(new Uint8Array(digest))
  sessionScope.assert(ticket)

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: APP_URL,
    scope: SPOTIFY_SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

async function tokenRequest(body: URLSearchParams, ticket: ReturnType<typeof sessionScope.capture>): Promise<StoredToken | null> {
  sessionScope.assert(ticket)
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  sessionScope.assert(ticket)
  if (!res.ok) return null
  const data = await res.json()
  sessionScope.assert(ticket)
  const prev = getStored()
  const stored: StoredToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? prev?.refresh_token ?? '',
    expiry: Date.now() + (data.expires_in - 60) * 1000,
  }
  sessionStorage.setItem(scopedStorageKey(TOKEN_KEY), JSON.stringify(stored))
  return stored
}

/** Da chiamare all'avvio: completa il ritorno dal login Spotify (?code=...). */
let callbackPending: Promise<boolean> | null = null
export function handleSpotifyCallback(): Promise<boolean> {
  if (callbackPending) return callbackPending
  callbackPending = completeSpotifyCallback().finally(() => { callbackPending = null })
  return callbackPending
}
async function completeSpotifyCallback(): Promise<boolean> {
  const ticket = sessionScope.capture()
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const returnedState = params.get('state')
  const verifier = sessionStorage.getItem(scopedStorageKey(VERIFIER_KEY))
  const expectedState = sessionStorage.getItem(scopedStorageKey(STATE_KEY))
  if (!code || !returnedState) return false
  if (!verifier || !expectedState || returnedState !== expectedState) {
    sessionStorage.removeItem(scopedStorageKey(VERIFIER_KEY))
    sessionStorage.removeItem(scopedStorageKey(STATE_KEY))
    window.history.replaceState({}, '', window.location.pathname)
    return false
  }
  sessionStorage.removeItem(scopedStorageKey(VERIFIER_KEY))
  sessionStorage.removeItem(scopedStorageKey(STATE_KEY))
  const clientId = await getOAuthClientId('spotify')
  sessionScope.assert(ticket)
  const stored = await tokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: APP_URL,
      client_id: clientId,
      code_verifier: verifier,
    }),
    ticket,
  )
  // Pulisce l'URL dal codice
  window.history.replaceState({}, '', window.location.pathname)
  return stored !== null
}

function getStored(): StoredToken | null {
  try {
    const raw = sessionStorage.getItem(scopedStorageKey(TOKEN_KEY))
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
  sessionStorage.removeItem(scopedStorageKey(TOKEN_KEY))
  sessionStorage.removeItem(scopedStorageKey(VERIFIER_KEY))
  sessionStorage.removeItem(scopedStorageKey(STATE_KEY))
}

/** Token valido, rinnovato automaticamente se scaduto. */
export async function getSpotifyToken(): Promise<string | null> {
  const ticket = sessionScope.capture()
  const stored = getStored()
  if (!stored) return null
  if (Date.now() < stored.expiry) return stored.access_token
  if (!stored.refresh_token) return null
  const clientId = await getOAuthClientId('spotify')
  sessionScope.assert(ticket)
  const renewed = await tokenRequest(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: stored.refresh_token,
      client_id: clientId,
    }),
    ticket,
  )
  sessionScope.assert(ticket)
  if (!renewed) {
    disconnectSpotify()
    return null
  }
  return renewed.access_token
}

export async function spotifyFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const ticket = sessionScope.capture()
  const token = await getSpotifyToken()
  sessionScope.assert(ticket)
  if (!token) throw new Error('Spotify non collegato')
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  })
  sessionScope.assert(ticket)
  if (res.status === 401) { disconnectSpotify(); throw new Error('Collegamento Spotify scaduto. Ricollega il tuo account.') }
  if (res.status === 204) return null
  if (!res.ok) throw new Error(`Spotify API ${res.status}`)
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : null
}
