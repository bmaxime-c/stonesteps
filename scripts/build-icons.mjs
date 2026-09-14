/*
 * Generateur des icones PWA.
 *
 *   node scripts/build-icons.mjs
 *
 * Ecrit a la main plutot que d'ajouter une dependance de rendu pour quatre
 * fichiers : zlib est dans Node, et le motif ne demande que des rectangles
 * arrondis. L'anticrenelage vient d'un surechantillonnage 4x, moyenne ensuite.
 *
 * Le motif reste la source vectorielle de public/icons/icon.svg : toute
 * retouche se fait la-bas d'abord, puis ici, puis on relance le script.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

/** Facteur de surechantillonnage : 4x suffit a lisser des coins arrondis. */
const SS = 4

const ACCENT = [0x00, 0xff, 0x87]
const INK = [0x05, 0x17, 0x0e]

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/**
 * PNG truecolor avec alpha.
 *
 * L'alpha sert aux coins arrondis de la variante « any » : sans lui, ils
 * sortiraient en noir opaque au lieu d'etre decoupes.
 */
function encodePng(width, height, rgba) {
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0 // filtre « none »
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // profondeur par canal
  ihdr[9] = 6 // truecolor avec alpha

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Un point est-il dans un rectangle a coins arrondis ? */
function inRoundedRect(px, py, x, y, w, h, r) {
  if (px < x || py < y || px > x + w || py > y + h) return false
  const cx = Math.min(Math.max(px, x + r), x + w - r)
  const cy = Math.min(Math.max(py, y + r), y + h - r)
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
}

/**
 * Trace le motif : trois marches montantes, encre sombre sur aplat neon.
 *
 * C'est le nom de l'application, et ca reste lisible a 48 px la ou un
 * monogramme se brouille.
 */
function draw(size, { maskable }) {
  const big = size * SS
  const unit = big / 512 // le motif est dessine sur une grille de 512

  // Zone sure de 80 % pour la variante maskable : les lanceurs Android rognent
  // les bords, le motif doit tenir au centre.
  const bars = maskable
    ? [
        { x: 140, y: 320, w: 72, r: 10 },
        { x: 236, y: 256, w: 72, r: 10 },
        { x: 332, y: 180, w: 72, r: 10 },
      ]
    : [
        { x: 96, y: 336, w: 88, r: 12 },
        { x: 212, y: 256, w: 88, r: 12 },
        { x: 328, y: 160, w: 88, r: 12 },
      ]
  const bottom = maskable ? 384 : 416
  const bgRadius = maskable ? 0 : 96

  const acc = new Float64Array(size * size * 4)

  for (let sy = 0; sy < big; sy += 1) {
    for (let sx = 0; sx < big; sx += 1) {
      const gx = sx / unit
      const gy = sy / unit

      let color = [0, 0, 0, 0]
      const onBackground =
        bgRadius === 0 || inRoundedRect(gx, gy, 0, 0, 512, 512, bgRadius)

      if (onBackground) {
        color = [...ACCENT, 255]
        for (const bar of bars) {
          if (inRoundedRect(gx, gy, bar.x, bar.y, bar.w, bottom - bar.y, bar.r)) {
            color = [...INK, 255]
            break
          }
        }
      }

      const base = (((sy / SS) | 0) * size + ((sx / SS) | 0)) * 4
      for (let channel = 0; channel < 4; channel += 1)
        acc[base + channel] += color[channel]
    }
  }

  const samples = SS * SS
  const rgba = Buffer.alloc(size * size * 4)
  for (let i = 0; i < rgba.length; i += 1) rgba[i] = Math.round(acc[i] / samples)
  return encodePng(size, size, rgba)
}

for (const size of [192, 512]) {
  writeFileSync(join(OUT, `icon-${size}.png`), draw(size, { maskable: false }))
  writeFileSync(join(OUT, `icon-maskable-${size}.png`), draw(size, { maskable: true }))
  console.log(`icon-${size}.png et icon-maskable-${size}.png`)
}
