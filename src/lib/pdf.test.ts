import { describe, expect, it } from 'vitest'
import { createPdfBlob, validateGeneratedDoc } from './pdf'

describe('PDF export', () => {
  it('rejects empty sections before generating a plausible but blank PDF', () => {
    expect(() => validateGeneratedDoc({ title: 'Titolo', sections: [{ heading: 'Sezione', body: '  ' }] })).toThrow()
    expect(() => validateGeneratedDoc({ title: 'Titolo', sections: [{ heading: 'Sezione', body: 'Testo' }], source: { kind: 'youtube' } })).toThrow()
  })

  it('paginates a single very long paragraph and includes source metadata', async () => {
    const blob = createPdfBlob({ title: 'Appunti', source: { kind: 'youtube', url: 'https://www.youtube.com/watch?v=abcdefghijk' }, sections: [{ heading: 'Budget', body: 'Una frase finanziaria molto lunga. '.repeat(400) }] })
    expect(blob.type).toBe('application/pdf')
    const content = new TextDecoder('latin1').decode(await blob.arrayBuffer())
    expect((content.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1)
    expect(content).toContain('www.youtube.com')
    expect(content).toContain('pagina 2 di')
  })
})
