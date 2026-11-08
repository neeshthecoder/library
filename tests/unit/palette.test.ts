import { describe, expect, it } from 'vitest'
import { hexToRgb, oklabToLinear, rgbToOklab } from '../../src/spines/color'
import { contrast } from '../../src/spines/contrast'
import { generatePalette, mulberry32 } from '../../src/spines/palette'

describe('generatePalette', () => {
  it('produces ≥ 3:1 trim contrast, in-gamut hex, for 10,000 seeds', () => {
    let min = Infinity
    for (let seed = 1; seed <= 10_000; seed++) {
      const { bg, trim } = generatePalette(mulberry32(seed))
      expect(bg).toMatch(/^#[0-9a-f]{6}$/)
      expect(trim).toMatch(/^#[0-9a-f]{6}$/)
      for (const hex of [bg, trim]) {
        const lin = oklabToLinear(rgbToOklab(hexToRgb(hex)))
        for (const c of lin) {
          expect(c).toBeGreaterThan(-1e-3)
          expect(c).toBeLessThan(1 + 1e-3)
        }
      }
      min = Math.min(min, contrast(bg, trim))
    }
    expect(min).toBeGreaterThanOrEqual(3)
  })

  it('is deterministic for a seed and varied across seeds', () => {
    expect(generatePalette(mulberry32(42))).toEqual(generatePalette(mulberry32(42)))
    const bgs = new Set(Array.from({ length: 50 }, (_, i) => generatePalette(mulberry32(i + 1)).bg))
    expect(bgs.size).toBeGreaterThan(40)
  })

  it('mostly picks dark backgrounds', () => {
    let dark = 0
    for (let s = 1; s <= 1000; s++) if (rgbToOklab(hexToRgb(generatePalette(mulberry32(s)).bg))[0] < 0.6) dark++
    expect(dark).toBeGreaterThan(650)
    expect(dark).toBeLessThan(850)
  })
})
