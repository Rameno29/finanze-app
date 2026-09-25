import { authenticatedClient, supabase } from './supabase'
import { sessionScope } from './sessionScope'

const DB_NAME = 'aje-offline-v1'
const DB_VERSION = 1
const STATUS_EVENT = 'aje-offline-status'

export type OfflineTable = 'transactions' | 'tasks'
export type OfflineOperation = 'insert' | 'update' | 'delete' | 'transfer' | 'delete-transfer'

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
  localRecord?: Record<string, unknown> | null
  createdAt: string
}

interface QueueRow extends Omit<OfflineMutation, 'payload' | 'localRecord'> {
  value: CipherText
  localValue?: CipherText
}

export interface OfflineStatus {
  online: boolean
  syncing: boolean
  pending: number
  lastError: string | null
}

let dbPromise: Promise<IDBDatabase> | null = null
const syncing = new Set<string>()
const lastErrors = new Map<string, string>()
const localLocks = new Map<string, Promise<unknown>>()

async function locked<T>(userId: string, action: () => Promise<T>): Promise<T> {
  const name = `aje-offline:${userId}`
  if (navigator.locks) return navigator.locks.request(name, action)
  const prior = localLocks.get(name) ?? Promise.resolve()
  const next = prior.catch(() => {}).then(action)
  localLocks.set(name, next)
  try { return await next } finally { if (localLocks.get(name) === next) localLocks.delete(name) }
}

function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Salvataggio offline non riuscito'))
  })
}
async function write(store: string, value: unknown, remove = false): Promise<void> {
  const tx = (await openDb()).transaction(store, 'readwrite')
  const done = committed(tx)
  if (remove) tx.objectStore(store).delete(value as IDBValidKey)
  else tx.objectStore(store).put(value)
  await done
}

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
  const candidate = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  // Recheck within one serialized read/write transaction, including across tabs.
  const tx = db.transaction('keys', 'readwrite')
  const done = committed(tx)
  const store = tx.objectStore('keys')
  let selected = candidate
  const read = store.get(userId)
  read.onsuccess = () => {
    if (read.result?.key) selected = read.result.key
    else store.put({ userId, key: candidate })
  }
  await done
  return selected
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
  const ticket = sessionScope.capture()
  const { data } = await supabase.auth.getSession()
  sessionScope.assert(ticket)
  if (!data.session?.user.id) throw new Error('Sessione scaduta: accedi di nuovo.')
  if (data.session.user.id !== ticket.userId) throw new Error('Sessione cambiata.')
  return data.session.user.id
}

export async function cacheData<T>(userId: string, collection: string, data: T): Promise<void> {
  try {
    const row: CacheRow = {
      key: `${userId}:${collection}`,
      userId,
      collection,
      value: await encrypt(userId, data),
    }
    await write('cache', row)
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
  const related = rows.filter((item) =>
    item.collection === table ||
    item.collection.startsWith(`${table}:`) ||
    // Cache derivate dai movimenti: vanno tenute coerenti con la coda offline.
    (table === 'transactions' && (item.collection === 'account-balances' || item.collection === 'recurring' || item.collection.startsWith('monthly-totals:v2:'))),
  )
  for (const row of related) {
    const list = await decrypt<Array<Record<string, unknown>>>(userId, row.value)
    const without = list.filter((item) => item.id !== recordId)
    let belongs = record !== null
    if (record && table === 'transactions') {
      if (row.collection.startsWith('transactions:')) {
        belongs = String(record.date ?? '').slice(0, 7) === row.collection.slice('transactions:'.length)
      } else if (row.collection === 'account-balances') {
        belongs = record.account_id != null
      } else if (row.collection === 'recurring') {
        belongs = record.recurrence != null
      }
    }
    if (belongs && record) without.push(record)
    row.value = await encrypt(userId, without)
    await write('cache', row)
  }
}

async function queueMutation(mutation: OfflineMutation): Promise<void> {
  const previous = (await queuedMutations(mutation.userId)).at(-1)
  mutation.createdAt = new Date(Math.max(Date.now(), previous ? Date.parse(previous.createdAt) + 1 : 0)).toISOString()
  const { payload, localRecord, ...metadata } = mutation
  const row: QueueRow = { ...metadata, value: await encrypt(mutation.userId, payload),
    ...(localRecord ? { localValue: await encrypt(mutation.userId, localRecord) } : {}),
  }
  await write('queue', row)
  await emitStatus(mutation.userId)
}

async function queuedMutations(userId: string): Promise<OfflineMutation[]> {
  const db = await openDb()
  const rows = await requestResult<QueueRow[]>(db.transaction('queue').objectStore('queue').index('userId').getAll(userId))
  const out = await Promise.all(rows.map(async ({ value, localValue, ...row }) => ({
    ...row,
    payload: await decrypt<Record<string, unknown>>(userId, value),
    localRecord: localValue ? await decrypt<Record<string, unknown>>(userId, localValue) : undefined,
  })))
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

async function removeMutation(id: string): Promise<void> {
  await write('queue', id, true)
}

function networkFailure(error: { message?: string } | null): boolean {
  if (!error) return false
  return /fetch|network|offline|connection/i.test(error.message ?? '')
}

async function execute(mutation: OfflineMutation, ticket: ReturnType<typeof sessionScope.capture>) {
  sessionScope.assert(ticket)
  if (mutation.userId !== ticket.userId) throw new Error('Sessione cambiata.')
  const { data } = await supabase.auth.getSession()
  sessionScope.assert(ticket)
  if (!data.session || data.session.user.id !== mutation.userId) throw new Error('Sessione cambiata.')
  const client = authenticatedClient(data.session.access_token)
  const checkMembership = async () => {
    const result = await client.from('app_members').select('status').eq('user_id', mutation.userId).maybeSingle()
    sessionScope.assert(ticket)
    return { error: result.error ?? (result.data?.status === 'active' ? null : new Error('Account non abilitato: le modifiche restano in attesa.')) }
  }
  const membership = await checkMembership()
  if (membership.error) return membership
  if (mutation.operation === 'transfer') return client.rpc('save_account_transfer', { legs: mutation.payload.legs })
  if (mutation.operation === 'delete-transfer') return client.rpc('delete_account_transfer', { group_id: mutation.recordId })
  // Upsert con UUID generato dal client rende il replay idempotente se la risposta di rete si perde
  // dopo che il server ha già completato l'inserimento.
  if (mutation.operation === 'insert') return client.from(mutation.table).upsert({ ...mutation.payload, id: mutation.recordId, user_id: mutation.userId }, { onConflict: 'id' })
  if (mutation.operation === 'update') {
    const result = await client.from(mutation.table).update({ ...mutation.payload, user_id: mutation.userId }).eq('id', mutation.recordId).eq('user_id', mutation.userId).select('id')
    return { error: result.error ?? (result.data?.length === 1 ? null : new Error('Modifica non applicata: record assente o accesso negato. La modifica resta in attesa.')) }
  }
  const result = await client.from(mutation.table).delete().eq('id', mutation.recordId).eq('user_id', mutation.userId).select('id')
  if (result.error || result.data?.length) return result
  // Zero rows may be an already-applied replay, but never acknowledge a suspended user.
  return checkMembership()
}

export async function mutateOffline(
  table: OfflineTable,
  operation: OfflineOperation,
  recordId: string,
  payload: Record<string, unknown>,
  localRecord: Record<string, unknown> | null,
): Promise<{ queued: boolean }> {
  const ticket = sessionScope.capture()
  const owned = [payload, localRecord, ...(operation === 'transfer' && Array.isArray(payload.legs) ? payload.legs : [])]
  if (owned.some(row => row?.user_id != null && row.user_id !== ticket.userId)) {
    throw new Error('Account cambiato: ripeti l’operazione.')
  }
  const userId = await currentUserId()
  const mutation: OfflineMutation = {
    id: crypto.randomUUID(), userId, table, operation, recordId, payload, localRecord,
    createdAt: new Date().toISOString(),
  }
  const updateLocal = async () => {
    if (operation === 'transfer') {
      for (const leg of payload.legs as Array<Record<string, unknown>>) await updateCachedEntity(userId, table, String(leg.id), leg)
    } else if (operation === 'delete-transfer') {
      const db = await openDb()
      const rows = await requestResult<CacheRow[]>(db.transaction('cache').objectStore('cache').index('userId').getAll(userId))
      for (const row of rows.filter(item => item.collection.startsWith('transactions:') || ['transactions','account-balances'].includes(item.collection))) {
        const records = await decrypt<Array<Record<string, unknown>>>(userId, row.value)
        // Balance cache may not include transfer_group: known leg IDs are also supplied by the UI.
        const ids = Array.isArray(payload.ids) ? payload.ids : []
        row.value = await encrypt(userId, records.filter(item => item.transfer_group !== recordId && !ids.includes(item.id)))
        await write('cache', row)
      }
    } else await updateCachedEntity(userId, table, recordId, localRecord)
  }

  return locked(userId, async () => {
    sessionScope.assert(ticket)
    // Never overtake an older queued mutation of the same record.
    if (navigator.onLine && (await queuedMutations(userId)).length === 0) {
      const { error } = await execute(mutation, ticket)
      sessionScope.assert(ticket)
      if (!error) {
        try { await updateLocal() } catch { /* scrittura server già riuscita */ }
        return { queued: false }
      }
      if (!networkFailure(error)) throw error
    }
    sessionScope.assert(ticket)
    await queueMutation(mutation)
    try { await updateLocal() } catch { /* la coda resta comunque persistita */ }
    return { queued: true }
  })
}

export async function syncOffline(userId: string): Promise<void> {
  if (syncing.has(userId) || !navigator.onLine) return
  let ticket: ReturnType<typeof sessionScope.capture>
  try { ticket = sessionScope.capture(); if (ticket.userId !== userId) return } catch { return }
  syncing.add(userId)
  lastErrors.delete(userId)
  try {
    await emitStatus(userId)
    await locked(userId, async () => {
    for (const mutation of await queuedMutations(userId)) {
      const { error } = await execute(mutation, ticket)
      sessionScope.assert(ticket)
      if (error) throw error
      await removeMutation(mutation.id)
    }
    })
  } catch (cause) {
    lastErrors.set(userId, cause instanceof Error ? cause.message : 'Sincronizzazione non riuscita')
  } finally {
    syncing.delete(userId)
    await emitStatus(userId)
  }
}

export async function getOfflineStatus(userId: string): Promise<OfflineStatus> {
  let pending = 0
  try { pending = (await queuedMutations(userId)).length } catch { /* storage non disponibile */ }
  return { online: navigator.onLine, syncing: syncing.has(userId), pending, lastError: lastErrors.get(userId) ?? null }
}

/** Do not let an online refresh hide edits that still belong to the local queue. */
export async function overlayPendingRows<T>(userId: string, collection: string, data: T[]): Promise<T[]> {
  const table = collection === 'tasks' ? 'tasks' : collection.startsWith('transactions:') || collection.startsWith('monthly-totals:v2:') || ['transactions','account-balances','recurring'].includes(collection) ? 'transactions' : null
  if (!table) return data
  let pending: OfflineMutation[]
  try { pending = await queuedMutations(userId) } catch { return data }
  const rows = new Map((data as Array<Record<string,unknown>>).map(row => [String(row.id), { ...row }]))
  for (const mutation of pending.filter(item=>item.table===table)) {
    if (mutation.operation === 'delete') rows.delete(mutation.recordId)
    else if (mutation.operation === 'delete-transfer') {
      const ids = Array.isArray(mutation.payload.ids) ? mutation.payload.ids : []
      for (const [id,row] of rows) if (row.transfer_group===mutation.recordId || ids.includes(id)) rows.delete(id)
    } else if (mutation.operation === 'transfer') {
      for (const leg of mutation.payload.legs as Array<Record<string,unknown>>) rows.set(String(leg.id),leg)
    } else {
      const previous = rows.get(mutation.recordId)
      // A changed date/account/recurrence can move a row INTO a filtered query.
      // The encrypted snapshot supplies fields not present in a partial update.
      const snapshot = mutation.localRecord
      if (previous || snapshot || mutation.operation === 'insert') rows.set(mutation.recordId, { ...snapshot,...previous,...mutation.payload,id:mutation.recordId,user_id:userId })
    }
  }
  return [...rows.values()].filter(row=>{
    if(collection.startsWith('transactions:')) return String(row.date??'').slice(0,7)===collection.slice('transactions:'.length)
    if(collection==='account-balances') return row.account_id!=null
    if(collection==='recurring') return row.recurrence!=null
    return true
  }) as T[]
}

async function emitStatus(userId: string) {
  window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: { userId, status: await getOfflineStatus(userId) } }))
}

export function subscribeOfflineStatus(userId: string, listener: (status: OfflineStatus) => void): () => void {
  let alive = true
  const onStatus = (event: Event) => {
    const detail = (event as CustomEvent<{ userId: string; status: OfflineStatus }>).detail
    if (alive && detail.userId === userId) listener(detail.status)
  }
  const onOnline = () => { void syncOffline(userId) }
  const onOffline = () => { void emitStatus(userId) }
  window.addEventListener(STATUS_EVENT, onStatus)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  void getOfflineStatus(userId).then(status => { if (alive) listener(status) })
  if (navigator.onLine) void syncOffline(userId)
  return () => {
    alive = false
    window.removeEventListener(STATUS_EVENT, onStatus)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}

export interface PendingChange {
  id: string
  label: string
  createdAt: string
}

const OPERATION_LABELS: Record<OfflineOperation, string> = {
  insert: 'Nuovo',
  update: 'Modifica',
  delete: 'Eliminazione',
  transfer: 'Trasferimento',
  'delete-transfer': 'Eliminazione trasferimento',
}

/** Descrizione breve di una modifica in coda, per l'elenco nelle Impostazioni (solo lettura). */
export function describeMutation(mutation: Pick<OfflineMutation, 'table' | 'operation' | 'payload' | 'localRecord'>): string {
  const record = { ...(mutation.localRecord ?? {}), ...mutation.payload } as Record<string, unknown>
  const what = mutation.table === 'tasks'
    ? `attività${typeof record.title === 'string' && record.title ? ` «${record.title}»` : ''}`
    : mutation.operation === 'transfer' || mutation.operation === 'delete-transfer'
      ? 'tra conti'
      : `movimento${typeof record.description === 'string' && record.description ? ` «${record.description}»` : ''}`
  return `${OPERATION_LABELS[mutation.operation]} ${what}`.replace('Nuovo attività', 'Nuova attività')
}

/** Modifiche ancora da sincronizzare, dalla più vecchia. */
export async function listPendingChanges(userId: string): Promise<PendingChange[]> {
  const queue = await queuedMutations(userId)
  return queue.map((mutation) => ({ id: mutation.id, label: describeMutation(mutation), createdAt: mutation.createdAt }))
}
