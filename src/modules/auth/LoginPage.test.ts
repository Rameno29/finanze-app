import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  it('presents access as the primary heading while keeping the login controls', () => {
    const html = renderToStaticMarkup(createElement(LoginPage))

    expect(html).toMatch(/<h1\b[^>]*>Accedi<\/h1>/)
    expect(html).toContain('type="email"')
    expect(html).toContain('type="password"')
    expect(html).toContain('Password dimenticata?')
  })
})
