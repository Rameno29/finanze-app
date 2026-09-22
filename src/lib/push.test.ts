import { afterEach, expect, it, vi } from 'vitest'
const backend = vi.hoisted(() => ({ upsert: vi.fn() }))
vi.mock('./supabase', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: 'A' } } }), getSession: async () => ({ data: { session: { user: { id: 'A' }, access_token: 'token-A' } } }) }, from: () => ({ upsert: backend.upsert }) },
  authenticatedClient: () => ({ from: () => ({ upsert: backend.upsert }) }),
}))
vi.mock('./integrations', () => ({ invokeFunction: vi.fn() }))
import { enablePush, setPushIdentity } from './push'
import { sessionScope } from './sessionScope'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

it('a delayed identity cache write cannot restore the previous user after logout', async () => {
  vi.useFakeTimers()
  let finishFirst!: () => void
  const started = new Promise<void>(resolve => { finishFirst = resolve })
  let saved: string | null = null
  const cache = { put: async (_key: string, response: Response) => {
    const { userId } = await response.json()
    if (userId === 'A') { finishFirst(); await new Promise<void>(resolve => { setTimeout(resolve, 20) }) }
    saved = userId
  } }
  vi.stubGlobal('window', { caches: {} })
  vi.stubGlobal('location', { origin: 'https://example.test' })
  vi.stubGlobal('caches', { open: async () => cache })
  const oldWrite = setPushIdentity('A')
  await started
  const logout = setPushIdentity(null)
  await vi.runAllTimersAsync()
  await Promise.all([oldWrite, logout])
  expect(saved).toBeNull()
})

it('enabling push reports unavailable registration without waiting forever for ready', async () => {
  vi.useFakeTimers()
  sessionScope.set('A')
  vi.stubGlobal('window', { PushManager: {}, Notification: {} })
  vi.stubGlobal('Notification', { requestPermission: async () => 'granted' })
  vi.stubGlobal('navigator', { serviceWorker: {
    getRegistration: async () => undefined,
    ready: new Promise(() => {}),
  } })
  const result = Promise.race([enablePush(), new Promise(resolve => setTimeout(() => resolve('still waiting'), 1000))])
  await vi.runAllTimersAsync()
  expect(await result).toEqual({ ok: false, reason: 'non_supportato' })
})

it('a subscription response after account change cannot restore the old push identity', async () => {
  sessionScope.set('A')
  const sub = { endpoint: 'https://fcm.googleapis.com/synthetic', toJSON: () => ({ keys: { p256dh: 'test', auth: 'test' } }), unsubscribe: async () => true }
  const registration = { pushManager: { getSubscription: async () => sub } }
  vi.stubGlobal('window', { PushManager: {}, Notification: {}, caches: {} })
  vi.stubGlobal('Notification', { requestPermission: async () => 'granted' })
  vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve(registration), getRegistration: async () => registration } })
  vi.stubGlobal('location', { origin: 'https://example.test' })
  let identity = 'B'
  vi.stubGlobal('caches', { open: async () => ({ put: async (_key: string, response: Response) => { identity = (await response.json()).userId } }) })
  backend.upsert.mockImplementation(async () => { sessionScope.set('B');return { error: null } })
  await expect(enablePush()).rejects.toThrow('Account cambiato')
  expect(identity).toBe('B')
})
