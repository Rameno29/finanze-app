/**
 * Credenziali pubbliche delle integrazioni (i "Client ID" non sono segreti:
 * identificano solo l'app presso Google/Spotify).
 * Quando Bogdan crea le app sviluppatore, incollare qui i rispettivi ID.
 */
export const GOOGLE_CLIENT_ID = ''
export const SPOTIFY_CLIENT_ID = ''

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
