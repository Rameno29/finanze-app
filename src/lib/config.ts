/**
 * Credenziali pubbliche delle integrazioni (i "Client ID" non sono segreti:
 * identificano solo l'app presso Google/Spotify).
 * Quando Bogdan crea le app sviluppatore, incollare qui i rispettivi ID.
 */
export const GOOGLE_CLIENT_ID: string =
  '969336966029-dtfmirhn1j8862o7u73jsv6fkdfcntu9.apps.googleusercontent.com'
export const SPOTIFY_CLIENT_ID: string = '498660831dd54572a6c056c852c47bea'

/**
 * Chiave API per la ricerca YouTube (YouTube Data API v3).
 * Non è nel codice: arriva dal secret GitHub VITE_YOUTUBE_API_KEY al momento della build
 * (in locale: file .env). La chiave è comunque vincolata al dominio dell'app su Google Cloud.
 */
export const YOUTUBE_API_KEY: string = import.meta.env.VITE_YOUTUBE_API_KEY ?? ''

export const APP_URL = 'https://rameno29.github.io/finanze-app/'

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
].join(' ')

export const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ')
