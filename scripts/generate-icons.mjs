import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url))

// Variante maskable: contenuto ridotto dentro la safe zone, sfondo pieno
const maskableSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <text x="256" y="315" font-family="-apple-system, 'Segoe UI', Roboto, sans-serif" font-size="190" font-weight="700" fill="#ffffff" text-anchor="middle">€</text>
  <rect x="161" y="350" width="190" height="16" rx="8" fill="#ffffff" opacity="0.85"/>
</svg>`)

await sharp(svg, { density: 300 }).resize(192, 192).png().toFile('public/pwa-192.png')
await sharp(svg, { density: 300 }).resize(512, 512).png().toFile('public/pwa-512.png')
await sharp(svg, { density: 300 }).resize(180, 180).flatten({ background: '#6366f1' }).png().toFile('public/apple-touch-icon.png')
await sharp(maskableSvg, { density: 300 }).resize(512, 512).png().toFile('public/pwa-maskable-512.png')

console.log('Icone generate.')
