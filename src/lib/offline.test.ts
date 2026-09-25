import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sessionScope } from './sessionScope'

const mocks = vi.hoisted(() => ({ session: { user: { id: 'A' }, access_token: 'token-A' }, writes: [] as Array<{ token: string; payload: unknown }>, pause: null as null | (() => Promise<void>), active: true, affected: [] as Array<{ id: string }> }))
vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: mocks.session } }) }, from: () => { throw new Error('Must use a pinned session') } },
  authenticatedClient: (token: string) => ({ from: (table: string) => {
    const query = {
      select: () => query, eq: () => query, update: () => query, delete: () => query,
      maybeSingle: async () => ({ data: mocks.active ? { status: 'active' } : { status: 'suspended' }, error: null }),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: table === 'app_members' ? { status: mocks.active ? 'active' : 'suspended' } : mocks.affected, error: null }).then(resolve),
      upsert: async (payload: unknown) => {
    mocks.writes.push({ token, payload }); await mocks.pause?.(); return { error: null }
      },
    }
    return query
  } }),
}))
import { cacheData, describeMutation, getOfflineStatus, mutateOffline, overlayPendingRows, readCachedData, syncOffline } from './offline'
import { fetchAccountBalances, fetchMonthlyTotals } from './data'

beforeEach(() => {
  vi.stubGlobal('window', Object.assign(new EventTarget(), { indexedDB, crypto }))
  vi.stubGlobal('navigator', { onLine: false })
  sessionScope.set('A')
  mocks.session = { user: { id: 'A' }, access_token: 'token-A' }
  mocks.writes = []; mocks.pause = null; mocks.active = true; mocks.affected = []
})

it('rejects an old account payload instead of reassigning it to the current account', async () => {
  const record={id:'old-diary-row',user_id:'A',amount_cents:500,category_id:null,account_id:null}
  sessionScope.set('new-diary-user');mocks.session={user:{id:'new-diary-user'},access_token:'token-B'}
  await expect(mutateOffline('transactions','insert',record.id,record,record)).rejects.toThrow('Account cambiato')
  expect((await getOfflineStatus('new-diary-user')).pending).toBe(0)
  expect(mocks.writes).toEqual([])
})

it('retains an update in the queue when the server affected no record', async () => {
  sessionScope.set('missing-update'); mocks.session = { user: { id: 'missing-update' }, access_token: 'token-update' }
  await mutateOffline('tasks', 'update', 'missing', { title: 'Keep this edit' }, null)
  Object.assign(navigator, { onLine: true })
  await syncOffline('missing-update')
  expect((await getOfflineStatus('missing-update')).pending).toBe(1)
  expect((await getOfflineStatus('missing-update')).lastError).toBeTruthy()
  mocks.affected = [{ id: 'missing' }]
  await syncOffline('missing-update')
  expect((await getOfflineStatus('missing-update')).pending).toBe(0)
})

it('retains a suspended member’s delete but allows an active idempotent replay', async () => {
  sessionScope.set('suspended-delete'); mocks.session = { user: { id: 'suspended-delete' }, access_token: 'token-delete' }
  await mutateOffline('tasks', 'delete', 'deleted', {}, null)
  mocks.active = false; Object.assign(navigator, { onLine: true })
  await syncOffline('suspended-delete')
  expect((await getOfflineStatus('suspended-delete')).pending).toBe(1)
  mocks.active = true
  await syncOffline('suspended-delete')
  expect((await getOfflineStatus('suspended-delete')).pending).toBe(0)
})

it('concurrent first cache writes retain the same non-exportable user key', async () => {
  await Promise.all(Array.from({ length: 8 }, (_, i) => cacheData('fresh', `list-${i}`, [i])))
  for (let i = 0; i < 8; i++) expect(await readCachedData('fresh', `list-${i}`)).toEqual([i])
  expect(await readCachedData('B', 'list-0')).toBeNull()
})

it('keeps an offline edit visible when it moves into a month absent from the server result', async () => {
  sessionScope.set('moved-month'); mocks.session = { user: { id: 'moved-month' }, access_token: 'token-moved' }
  const old = { id: 'moving', date: '2026-01-31', kind: 'expense', amount_cents: 1200, account_id: 'bank', description: 'Saved detail' }
  await mutateOffline('transactions', 'update', old.id, { date: '2026-02-01' }, { ...old, date: '2026-02-01' })
  expect(await overlayPendingRows('moved-month', 'transactions:2026-01', [old])).toEqual([])
  expect(await overlayPendingRows('moved-month', 'transactions:2026-02', [])).toEqual([
    { ...old, date: '2026-02-01', user_id: 'moved-month' },
  ])
  expect(await overlayPendingRows('B', 'transactions:2026-02', [])).toEqual([])
})

it('preserves a row entering a derived account balance query after an offline edit', async () => {
  sessionScope.set('new-account'); mocks.session = { user: { id: 'new-account' }, access_token: 'token-new-account' }
  const row = { id: 'assigned', date: '2026-02-01', kind: 'income', amount_cents: 1700, account_id: 'bank' }
  await mutateOffline('transactions', 'update', row.id, { account_id: 'bank' }, row)
  expect(await overlayPendingRows('new-account', 'account-balances', [])).toEqual([{ ...row, user_id: 'new-account' }])
  const balances = await fetchAccountBalances([{ id:'bank',user_id:'new-account',name:'Bank',kind:'banca',initial_balance_cents:300,created_at:'2026-01-01' }])
  expect(balances.get('bank')).toBe(2000)
})

it('monthly totals include queued income and remove queued deletions without a network', async () => {
  sessionScope.set('totals'); mocks.session = { user: { id: 'totals' }, access_token: 'token-totals' }
  const now = new Date(), date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const original = [{ id: 'obsolete', date, kind: 'expense', amount_cents: 9900 }]
  await cacheData('totals', 'monthly-totals:1', original)
  await cacheData('totals', 'monthly-totals:v2:1', original)
  const income = { id: 'new-income', date, kind: 'income', amount_cents: 2500 }
  await mutateOffline('transactions', 'insert', income.id, income, income)
  await mutateOffline('transactions', 'delete', 'obsolete', {}, null)
  expect(await fetchMonthlyTotals(1)).toEqual([{ month: date.slice(0,7), income: 2500, expense: 0 }])
})

it('stops replay on identity change and never borrows the new user token', async () => {
  await mutateOffline('transactions', 'insert', 'one', { id: 'one', user_id: 'A' }, { id: 'one' })
  await mutateOffline('transactions', 'insert', 'two', { id: 'two', user_id: 'A' }, { id: 'two' })
  let release!: () => void
  mocks.pause = () => new Promise<void>(resolve => { release = resolve })
  Object.assign(navigator, { onLine: true })
  const running = syncOffline('A')
  await vi.waitFor(() => expect(mocks.writes).toHaveLength(1))
  sessionScope.set('B'); mocks.session = { user: { id: 'B' }, access_token: 'token-B' }
  release(); await running
  expect(mocks.writes.map(w => w.token)).toEqual(['token-A'])
  expect((await getOfflineStatus('B')).pending).toBe(0)
  expect((await getOfflineStatus('A')).pending).toBe(2)
  mocks.pause = null
  await syncOffline('A')
  expect(mocks.writes).toHaveLength(1)
  sessionScope.set('A'); mocks.session = { user: { id: 'A' }, access_token: 'token-A' }
  await Promise.all([syncOffline('A'), syncOffline('A')])
  expect((await getOfflineStatus('A')).pending).toBe(0)
  expect(mocks.writes).toHaveLength(3)
})

describe('describeMutation', () => {
  it('descrive movimenti, attività e trasferimenti in coda', () => {
    expect(describeMutation({ table: 'transactions', operation: 'insert', payload: { description: 'Pizza' } })).toBe('Nuovo movimento «Pizza»')
    expect(describeMutation({ table: 'tasks', operation: 'insert', payload: { title: 'Bollo' } })).toBe('Nuova attività «Bollo»')
    expect(describeMutation({ table: 'tasks', operation: 'update', payload: { done: true }, localRecord: { title: 'Bollo' } })).toBe('Modifica attività «Bollo»')
    expect(describeMutation({ table: 'transactions', operation: 'delete', payload: {} })).toBe('Eliminazione movimento')
    expect(describeMutation({ table: 'transactions', operation: 'transfer', payload: {} })).toBe('Trasferimento tra conti')
  })
})
