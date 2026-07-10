/** Accetta solo URL web assoluti, evitando schemi eseguibili nei link prodotti da servizi esterni/AI. */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}
