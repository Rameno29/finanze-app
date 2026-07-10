import { describe, expect, it } from 'vitest'
import { isSafeHttpUrl } from './url'

describe('isSafeHttpUrl', () => {
  it.each(['https://example.com/a', 'http://localhost:5173/test'])('accetta %s', (url) => {
    expect(isSafeHttpUrl(url)).toBe(true)
  })

  it.each(['javascript:alert(1)', 'data:text/html,test', '/relativo', 'non-un-url'])('rifiuta %s', (url) => {
    expect(isSafeHttpUrl(url)).toBe(false)
  })
})
