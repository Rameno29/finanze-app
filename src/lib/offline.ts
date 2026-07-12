import { supabase } from './supabase'

const DB_NAME = 'aje-offline-v1'
const DB_VERSION = 1
const STATUS_EVENT = 'aje-offline-status'

export type OfflineTable = 'transactions' | 'tasks'
export type OfflineOperation = 'insert' | 'update' | 'delete'

interface CipherText {
  iv: ArrayBuffer
  data: ArrayBuffer
}

interface CacheRow {
  key: string
  userId: string
  collection: string
  value: CipherText
}

export interface OfflineMutation {
  id: string
  userId: string
  table: OfflineTable
  operation: OfflineOperation
  recordId: string
  payload: Record<string, unknown>
  createdAt: string
}

interface QueueRow extends Omit<OfflineMutation, 'payload'> {
  value: CipherText
}

export interface OfflineStatus {
  online: boolean
  syncing: boolean
  pending: number
  lastError: string | null
}

let dbPromise: Promise<IDBDatabase> | null = null
let syncing = false
let lastError: string | null = null

function openDb(): Promise<IDBDatabase> {
  if (!('indexedDB' in window) || !('crypto' in window) || !crypto.subtle) {
    return Promise.reject(new Error('Archivio offline non supportato'))
  }
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys', { keyPath: 'userId' })
      if (!db.objectStoreNames.contains('cache')) {
        const store = db.createObjectStore('cache', { keyPath: 'key' })
        store.createIndex('userId', 'userId')
      }
      if (!db.objectStoreNames.contains('queue')) {
        const store = db.createObjectStore('queue', { keyPath: 'id' })
        store.createIndex('userId', 'userId')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Apertura archivio offline non riuscita'))
  })
  return dbPromise
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Operazione IndexedDB non riuscita'))
  })
}

async function cryptoKey(userId: string): Promise<CryptoKey> {
  const db = await openDb()
  const existing = await requestResult<{ userId: string; key: CryptoKey } | undefined>(
    db.transaction('keys').objectStore('keys').get(userId),
  )
  if (existing?.key) return existing.key
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await requestResult(db.transaction('keys', 'readwrite').objectStore('keys').put({ userId, key }))
  return key
}

async function encrypt(userId: string, value: unknown): Promise<CipherText> {
  const key = await cryptoKey(userId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plain = new TextEncoder().encode(JSON.stringify(value))
  return { iv: iv.buffer, data: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain) }
}

async function decrypt<T>(userId: string, value: CipherText): Promise<T> {
  const key = await cryptoKey(userId)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(value.iv) }, key, value.data)
  return JSON.parse(new TextDecoder().decode(plain)) as T
}

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.user.id) throw new Error('Sessione scaduta: accedi di nuovo.')
  return data.session.user.id
}

export async function cacheData<T>(userId: string, collection: string, data: T): Promise<void> {
  try {
    const db = await openDb()
    const row: CacheRow = {
      key: `${userId}:${collection}`,
      userId,
      collection,
      value: await encrypt(userId, data),
    }
    await requestResult(db.transaction('cache', 'readwrite').objectStore('cache').put(row))
  } catch {
    // La cache non deve mai interrompere una lettura online riuscita.
  }
}

export async function readCachedData<T>(userId: string, collection: string): Promise<T | null> {
  try {
    const db = await openDb()
    const row = await requestResult<CacheRow | undefined>(
      db.transaction('cache').objectStore('cache').get(`${userId}:${collection}`),
    )
    return row ? await decrypt<T>(userId, row.value) : null
  } catch {
    return null
  }
}

async function updateCachedEntity(
  userId: string,
  table: OfflineTable,
  recordId: string,
  record: Record<string, unknown> | null,
): Promise<void> {
  const db = await openDb()
  const rows = await requestResult<CacheRow[]>(db.transaction('cache').objectStore('cache').index('userId').getAll(userId))
  for (const row of rows.filter((item) => item.collection === table || item.collection.startsWith(`${table}:`))) {
    const list = await decrypt<Array<Record<string, unknown>>>(userId, row.value)
    const without = list.filter((item) => item.id !== recordId)
    let belongs = record !== null
    if (record && table === 'transactions' && row.collection.startsWith('transactions:')) {
      belongs = String(record.date ?? '').slice(0, 7) === row.collection.slice('transactions:'.length)
    }
    if (belongs && record) without.push(record)
    row.value = await encrypt(userId, without)
    await requestResult(db.transaction('cache', 'readwrite').objectStore('cache').put(row))
  }
}

async function queueMutation(mutation: OfflineMutation): Promise<void> {
  const db = await openDb()
  const { payload, ...metadata } = mutation
  const row: QueueRow = { ...metadata, value: await encrypt(mutation.userId, payload) }
  await requestResult(db.transaction('queue', 'readwrite').objectStore('queue').put(row))
  await emitStatus(mutation.userId)
}

async function queuedMutations(userId: string): Promise<OfflineMutation[]> {
  const db = await openDb()
  const rows = await requestResult<QueueRow[]>(db.transaction('queue').objectStore('queue').index('userId').getAll(userId))
  const out = await Promise.all(rows.map(async ({ value, ...row }) => ({
    ...row,
    payload: await decrypt<Record<string, unknown>>(userId, value),
  })))
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

async function removeMutation(id: string): Promise<void> {
  const db = await openDb()
  await requestResult(db.transaction('queue', 'readwrite').objectStore('queue').delete(id))
}

function networkFailure(error: { message?: string } | null): boolean {
  if (!error) return false
  return /fetch|network|offline|connection/i.test(error.message ?? '')
}

async function execute(mutation: OfflineMutation) {
  // Upsert con UUID generato dal client rende il replay idempotente se la risposta di rete si perde
  // dopo che il server ha già completato l'inserimento.
  if (mutation.operation === 'insert') return supabase.from(mutation.table).upsert(mutation.payload, { onConflict: 'id' })
  if (mutation.operation === 'update') {
    return supabase.from(mutation.table).update(mutation.payload).eq('id', mutation.recordId)
  }
  return supabase.from(mutation.table).delete().eq('id', mutation.recordId)
}

export async function mutateOffline(
  table: OfflineTable,
  operation: OfflineOperation,
  recordId: string,
  payload: Record<string, unknown>,
  localRecord: Record<string, unknown> | null,
): Promise<{ queued: boolean }> {
  const userId = await currentUserId()
  const mutation: OfflineMutation = {
    id: crypto.randomUUID(), userId, table, operation, recordId, payload,
    createdAt: new Date().toISOString(),
  }

  if (navigator.onLine) {
    const { error } = await execute(mutation)
    if (!error) {
      try { await updateCachedEntity(userId, table, recordId, localRecord) } catch { /* scrittura server già riuscita */ }
      return { queued: false }
    }
    if (!networkFailure(error)) throw error
  }

  await queueMutation(mutation)
  try { await updateCachedEntity(userId, table, recordId, localRecord) } catch { /* la coda resta comunque persistita */ }
  return { queued: true }
}

export async function syncOffline(userId: string): Promise<void> {
  if (syncing || !navigator.onLine) return
  syncing = true
  lastError = null
  await emitStatus(userId)
  try {
    for (const mutation of await queuedMutations(userId)) {
      const { error } = await execute(mutation)
      if (error) throw error
      await removeMutation(mutation.id)
    }
  } catch (cause) {
    lastError = cause instanceof Error ? cause.message : 'Sincronizzazione non riuscita'
  } finally {
    syncing = false
    await emitStatus(userId)
  }
}

export async function getOfflineStatus(userId: string): Promise<OfflineStatus> {
  let pending = 0
  try { pending = (await queuedMutations(userId)).length } catch { /* storage non disponibile */ }
  return { online: navigator.onLine, syncing, pending, lastError }
}

async function emitStatus(userId: string) {
  window.dispatchEvent(new CustomEvent<OfflineStatus>(STATUS_EVENT, { detail: await getOfflineStatus(userId) }))
}

export function subscribeOfflineStatus(userId: string, listener: (status: OfflineStatus) => void): () => void {
  const onStatus = (event: Event) => listener((event as CustomEvent<OfflineStatus>).detail)
  const onOnline = () => { void syncOffline(userId) }
  const onOffline = () => { void emitStatus(userId) }
  window.addEventListener(STATUS_EVENT, onStatus)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  void getOfflineStatus(userId).then(listener)
  if (navigator.onLine) void syncOffline(userId)
  return () => {
    window.removeEventListener(STATUS_EVENT, onStatus)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}
