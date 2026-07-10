import { describe, expect, it } from 'vitest'
import { extractYouTubeId } from './PlayerContext'

const ID = 'dQw4w9WgXcQ'

describe('extractYouTubeId', () => {
  it.each([
    ID,
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://m.youtube.com/shorts/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
  ])('estrae un ID valido da %s', (input) => {
    expect(extractYouTubeId(input)).toBe(ID)
  })

  it.each([
    `https://example.com/watch?v=${ID}`,
    'https://youtube.com/watch?v=corto',
    'testo casuale',
  ])('rifiuta input non YouTube %s', (input) => {
    expect(extractYouTubeId(input)).toBeNull()
  })
})
