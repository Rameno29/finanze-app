import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('./icon-source.png', import.meta.url))
const GREEN = '#03372f'
const SIZE = 1254
const RADIUS = 280

// Maschera con angoli arrotondati (gli angoli del PNG sorgente sono neri opachi)
const roundedMask = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" fill="#fff"/></svg>`,
)

async function main() {
  // Versione con angoli trasparenti
  const rounded = await sharp(SRC)
    .composite([{ input: roundedMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  // Versione quadrata a tutto campo: contenuto arrotondato su fondo verde
  const fullBleed = await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: GREEN },
  })
    .composite([{ input: rounded }])
    .png()
    .toBuffer()

  // Icone PWA "any": mantengono gli angoli arrotondati trasparenti
  await sharp(rounded).resize(192, 192).png().toFile('public/pwa-192.png')
  await sharp(rounded).resize(512, 512).png().toFile('public/pwa-512.png')
  await sharp(rounded).resize(64, 64).png().toFile('public/favicon.png')

  // Apple touch: quadrata (iOS applica da sé gli angoli)
  await sharp(fullBleed).resize(180, 180).flatten({ background: GREEN }).png().toFile('public/apple-touch-icon.png')

  // Maskable per Android: contenuto ridotto all'80% su fondo verde
  const inner = await sharp(fullBleed).resize(410, 410).png().toBuffer()
  await sharp({ create: { width: 512, height: 512, channels: 4, background: GREEN } })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toFile('public/pwa-maskable-512.png')

  console.log('Icone AJE generate.')
}

await main()
