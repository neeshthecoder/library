import { describe, expect, it } from 'vitest'
import { rgbToHex } from '../../src/spines/color'
import { contrast, DARK_INK, ensureContrast, LIGHT_INK, luminance, pickTitleInk } from '../../src/spines/contrast'

describe('contrast', () => {
  it('matches WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
    expect(luminance('#ffffff')).toBeCloseTo(1, 6)
  })

  it('uses the trim as title ink when it reaches 4.5:1', () => {
    expect(pickTitleInk('#1a2b30', '#f0c27a')).toBe('#f0c27a')
  })

  it('falls back to paper or ink when the trim is too weak', () => {
    expect(pickTitleInk('#1a2b30', '#3a4b50')).toBe(LIGHT_INK)
    expect(pickTitleInk('#f0ead8', '#e0d5b8')).toBe(DARK_INK)
  })

  it("always reaches 4.5:1 for any background (sRGB sweep, step 5)", () => {
    let worst = Infinity
    for (let r = 0; r <= 255; r += 5)
      for (let g = 0; g <= 255; g += 5)
        for (let b = 0; b <= 255; b += 5) {
          const bg = rgbToHex([r / 255, g / 255, b / 255])
          worst = Math.min(worst, contrast(bg, pickTitleInk(bg, bg)))
        }
    expect(worst).toBeGreaterThanOrEqual(4.5)
  })

  it('ensureContrast darkens light colors against paper until 3:1', () => {
    const c = ensureContrast('#f5e6a0', '#F8F6F1', 3)
    expect(contrast(c, '#F8F6F1')).toBeGreaterThanOrEqual(3)
    expect(ensureContrast('#303a4e', '#F8F6F1', 3)).toBe('#303a4e')
  })
})
