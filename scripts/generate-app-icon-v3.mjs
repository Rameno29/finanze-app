import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const source = (name) => fileURLToPath(new URL(name, import.meta.url))
const output = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url))

const MARK = source('./aje-brand-mark-v3-source.png')
const GREEN = '#004438'
const SIZE = 1254

async function main() {
  const roundedMask = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="280" fill="#fff"/></svg>`,
  )
  const rounded = await sharp(MARK)
    .composite([{ input: roundedMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  await sharp(rounded).resize(192, 192).png().toFile(output('pwa-192-v3.png'))
  await sharp(rounded).resize(512, 512).png().toFile(output('pwa-512-v3.png'))
  await sharp(rounded).resize(64, 64).png().toFile(output('favicon-v3.png'))
  await sharp(rounded).resize(128, 128).webp({ quality: 94 }).toFile(output('aje-icon-v3.webp'))
  await sharp(MARK).resize(180, 180).png().toFile(output('apple-touch-icon-v3.png'))

  const safeSize = 410
  const { data } = await sharp(MARK).resize(safeSize, safeSize).raw().toBuffer({ resolveWithObject: true })
  const feathered = Buffer.alloc(safeSize * safeSize * 4)
  for (let y = 0; y < safeSize; y += 1) {
    for (let x = 0; x < safeSize; x += 1) {
      const pixel = y * safeSize + x
      const edge = Math.min(x, y, safeSize - 1 - x, safeSize - 1 - y)
      const t = Math.min(1, edge / 32)
      const alpha = t * t * (3 - 2 * t)
      feathered[pixel * 4] = data[pixel * 3]
      feathered[pixel * 4 + 1] = data[pixel * 3 + 1]
      feathered[pixel * 4 + 2] = data[pixel * 3 + 2]
      feathered[pixel * 4 + 3] = Math.round(alpha * 255)
    }
  }
  const safeMark = await sharp(feathered, { raw: { width: safeSize, height: safeSize, channels: 4 } }).png().toBuffer()
  await sharp({ create: { width: 512, height: 512, channels: 4, background: GREEN } })
    .composite([{ input: safeMark, gravity: 'center' }])
    .png()
    .toFile(output('pwa-maskable-512-v3.png'))

  console.log('Icona AJE deluxe v3 generata.')
}

await main()
