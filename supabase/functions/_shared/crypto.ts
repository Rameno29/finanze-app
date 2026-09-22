export interface SealedCredential {
  ciphertext: string
  nonce: string
  key_version: string
}

const encoder = new TextEncoder()
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const decode = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0))

async function importMasterKey(base64: string) {
  const raw = decode(base64)
  if (raw.length !== 32) throw new Error('credential_service_unavailable')
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

function context(userId: string, provider: string, version: string) {
  return encoder.encode(JSON.stringify(['aje-credential-v1', userId, provider, version]))
}

export async function sealCredential(value: string, userId: string, provider: string, version: string, masterKey: string): Promise<SealedCredential> {
  const key = await importMasterKey(masterKey)
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: context(userId, provider, version) }, key, encoder.encode(value))
  return { ciphertext: encode(new Uint8Array(ciphertext)), nonce: encode(nonce), key_version: version }
}

export async function openCredential(value: SealedCredential, userId: string, provider: string, masterKey: string): Promise<string> {
  const key = await importMasterKey(masterKey)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(value.nonce), additionalData: context(userId, provider, value.key_version) }, key, decode(value.ciphertext))
  return new TextDecoder().decode(plain)
}

export async function fingerprint(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
  return Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('')
}
