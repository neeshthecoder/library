import { hexToOklch, oklchToHex } from './color'
import { contrast } from './contrast'

export type Rng = () => number

/** mulberry32: small seedable PRNG. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const range = (r: Rng, lo: number, hi: number) => lo + (hi - lo) * r()

export const MIN_TRIM_CONTRAST = 3
const TARGET = 3.5
const FALLBACK = { bg: '#24413a', trim: '#e0864a' }

export interface Pair { bg: string; trim: string }

/** Finds the trim lightness (bisection) that reaches the target contrast. */
function solveTrim(bg: string, C: number, H: number, lighter: boolean): string {
  let lo = lighter ? hexToOklch(bg)[0] : 0
  let hi = lighter ? 1 : hexToOklch(bg)[0]
  let best = oklchToHex([lighter ? 1 : 0, C, H])
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2
    const hex = oklchToHex([mid, C, H])
    if (contrast(bg, hex) >= TARGET) {
      best = hex
      // move toward the background to keep the trim as rich as possible
      if (lighter) hi = mid
      else lo = mid
    } else if (lighter) lo = mid
    else hi = mid
  }
  return best
}

/** Random, harmonious, high-contrast background + trim pair. */
export function generatePalette(rng: Rng = Math.random): Pair {
  for (let attempt = 0; attempt < 20; attempt++) {
    const dark = rng() < 0.75
    const bgH = range(rng, 0, 360)
    const bg = dark
      ? oklchToHex([range(rng, 0.24, 0.4), range(rng, 0.04, 0.1), bgH])
      : oklchToHex([range(rng, 0.84, 0.92), range(rng, 0.03, 0.08), bgH])
    const complementary = rng() < 0.65
    const offset = complementary ? range(rng, 150, 210) : (rng() < 0.5 ? -1 : 1) * range(rng, 25, 40)
    const trimH = (bgH + offset + 360) % 360
    const trim = solveTrim(bg, range(rng, 0.1, 0.17), trimH, dark)
    if (contrast(bg, trim) >= MIN_TRIM_CONTRAST) return { bg, trim }
  }
  return { ...FALLBACK }
}

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}
