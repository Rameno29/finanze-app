import { describe, expect, it } from 'vitest'
import { createSessionScope } from './sessionScope'

describe('session identity boundaries', () => {
  it('rejects work from A after switching to B or signing out', () => {
    const scope = createSessionScope()
    scope.set('A')
    const ticket = scope.capture()
    scope.set('B')
    expect(() => scope.assert(ticket)).toThrow()
    scope.set('A')
    expect(() => scope.assert(ticket)).toThrow()
    scope.set(null)
    expect(() => scope.capture()).toThrow()
  })
  it('keeps requests valid when only the same user token refreshes', () => {
    const scope = createSessionScope()
    scope.set('A')
    const ticket = scope.capture()
    scope.set('A')
    expect(() => scope.assert(ticket)).not.toThrow()
  })
})
