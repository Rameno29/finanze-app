import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  it('welcomes back with the primary heading while keeping the login controls', () => {
    const html = renderToStaticMarkup(createElement(LoginPage))

    // Redesign "Flusso": titolo "Bentornato.", l'azione "Accedi" è il pulsante principale.
    expect(html).toMatch(/<h1\b[^>]*>Bentornato\.<\/h1>/)
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Accedi<\/button>/)
    expect(html).toContain('type="email"')
    expect(html).toContain('type="password"')
    expect(html).toContain('Password dimenticata?')
  })
})
