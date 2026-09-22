// Client ID e API key sono personali e configurati nelle Impostazioni, mai nella build.
export const APP_URL = 'https://rameno29.github.io/finanze-app/'

/** Chiave pubblica VAPID per le notifiche push (la privata sta al sicuro sul server). */
export const VAPID_PUBLIC_KEY =
  'BEadnMxF4PKjYHy5vhrrifUFcNLJ1RR2p6cBjw7JQsdFO-swE6_FKsEIfyMODplPrmDGZ8jxhrtwMWLXVH9NUVk'

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
