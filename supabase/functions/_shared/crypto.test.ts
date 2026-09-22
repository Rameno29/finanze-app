import { describe, expect, it } from 'vitest'
import { sealCredential, openCredential } from './crypto.ts'

const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
describe('encrypted credentials', () => {
  it('round trips but uses a new nonce for each write', async () => {
    const a = await sealCredential('secret', 'user-a', 'gemini', 'v1', key)
    const b = await sealCredential('secret', 'user-a', 'gemini', 'v1', key)
    expect(a.nonce).not.toBe(b.nonce)
    expect(a.ciphertext).not.toContain('secret')
    expect(await openCredential(a, 'user-a', 'gemini', key)).toBe('secret')
  })
  it('rejects swapping users, providers, versions, ciphertext or encryption keys', async () => {
    const a = await sealCredential('secret', 'user-a', 'gemini', 'v1', key)
    await expect(openCredential(a, 'user-b', 'gemini', key)).rejects.toThrow()
    await expect(openCredential(a, 'user-a', 'youtube', key)).rejects.toThrow()
    await expect(openCredential({ ...a, key_version: 'v2' }, 'user-a', 'gemini', key)).rejects.toThrow()
    await expect(openCredential({ ...a, ciphertext: a.ciphertext.slice(0, -4) + 'AAAA' }, 'user-a', 'gemini', key)).rejects.toThrow()
    await expect(openCredential(a, 'user-a', 'gemini', btoa('0'.repeat(32)))).rejects.toThrow()
  })
  it('fails closed on invalid master key configuration', async () => {
    await expect(sealCredential('secret', 'a', 'gemini', 'v1', '')).rejects.toThrow()
  })
})
