import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const source = (name) => fileURLToPath(new URL(name, import.meta.url))
const output = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url))

const MARK = source('./aje-brand-mark-v2-source.png')
const LOCKUP = source('./aje-brand-lockup-v2-source.png')
const WORDMARK_DARK = source('./aje-brand-wordmark-dark-v2-source.png')
const GREEN = '#03372f'
const SIZE = 1254

async function main() {
  // La sorgente resta intatta; le icone v2 hanno nomi nuovi per poter tornare al marchio precedente.
  const roundedMask = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="280" fill="#fff"/></svg>`,
  )
  const rounded = await sharp(MARK)
    .composite([{ input: roundedMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  await sharp(rounded).resize(192, 192).png().toFile(output('pwa-192-v2.png'))
  await sharp(rounded).resize(512, 512).png().toFile(output('pwa-512-v2.png'))
  await sharp(rounded).resize(64, 64).png().toFile(output('favicon-v2.png'))
  await sharp(rounded).resize(128, 128).webp({ quality: 94 }).toFile(output('aje-icon-v2.webp'))

  await sharp(MARK).resize(180, 180).png().toFile(output('apple-touch-icon-v2.png'))

  const safeMark = await sharp(MARK).resize(410, 410).png().toBuffer()
  await sharp({ create: { width: 512, height: 512, channels: 4, background: GREEN } })
    .composite([{ input: safeMark, gravity: 'center' }])
    .png()
    .toFile(output('pwa-maskable-512-v2.png'))

  await sharp(LOCKUP).trim().webp({ quality: 94, effort: 6 }).toFile(output('aje-logo-v2.webp'))
  await sharp(WORDMARK_DARK).trim().webp({ quality: 94, effort: 6 }).toFile(output('aje-wordmark-dark-v2.webp'))

  console.log('Brand AJE v2 generato.')
}

await main()
