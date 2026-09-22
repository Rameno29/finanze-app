import { afterEach, expect, it, vi } from 'vitest'
import { sessionScope } from './sessionScope'

const lookup = vi.hoisted(() => ({ clientId: vi.fn() }))
vi.mock('./integrations', () => ({ getOAuthClientId: lookup.clientId }))
import { getSpotifyToken } from './spotifyAuth'

afterEach(() => vi.unstubAllGlobals())

it('does not refresh or store A’s Spotify token under B after client ID lookup', async () => {
  const values = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) })
  sessionScope.set('A')
  values.set('aje-oauth:A:spotify_token', JSON.stringify({ access_token: 'expired-A', refresh_token: 'refresh-A', expiry: 0 }))
  lookup.clientId.mockImplementation(async () => { sessionScope.set('B'); return 'client-A' })
  const sent: string[] = []
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    sent.push(String(init.body))
    return Response.json({ access_token: 'renewed-A', refresh_token: 'refresh-A', expires_in: 3600 })
  })
  await expect(getSpotifyToken()).rejects.toThrow('Account cambiato')
  expect(values.has('aje-oauth:B:spotify_token')).toBe(false)
  expect(sent).toEqual([])
})
