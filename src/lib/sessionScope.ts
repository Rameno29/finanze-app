export function createSessionScope() {
  let userId: string | null = null
  let generation = 0
  return {
    set(next: string | null) {
      if (next !== userId) { userId = next; generation++ }
    },
    capture() {
      if (!userId) throw new Error('Accedi di nuovo per continuare.')
      return { userId, generation }
    },
    assert(ticket: { userId: string; generation: number }) {
      if (ticket.userId !== userId || ticket.generation !== generation) {
        throw new Error('Account cambiato: ripeti l’operazione.')
      }
    },
  }
}

export const sessionScope = createSessionScope()

/** Removes legacy and current OAuth data; never clears pending financial operations. */
export function clearExternalSessions() {
  try {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const name of Object.keys(storage)) {
      if (/^(google_token|spotify_token|spotify_state|spotify_verifier)$/.test(name) || name.startsWith('aje-oauth:')) {
        storage.removeItem(name)
      }
    }
  }
  } catch { /* Storage may be disabled; authentication must still be invalidated. */ }
}

export function scopedStorageKey(provider: string): string {
  return `aje-oauth:${sessionScope.capture().userId}:${provider}`
}
