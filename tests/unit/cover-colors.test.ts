import { describe, expect, it } from 'vitest'
import { colorsFromPixels, synthesizeAccent } from '../../src/spines/cover-colors'
import { contrast } from '../../src/spines/contrast'
import { hexToRgb } from '../../src/spines/color'

function image(w: number, h: number, paint: (x: number, y: number) => [number, number, number, number?]) {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b, a = 255] = paint(x, y)
    d.set([r, g, b, a], (y * w + x) * 4)
  }
  return d
}
const close = (hex: string, rgb: [number, number, number], tol = 12) =>
  hexToRgb(hex).every((c, i) => Math.abs(c * 255 - rgb[i]) <= tol)

describe('cover colors', () => {
  it('finds dominant green and orange accent', () => {
    const d = image(48, 72, (x, y) => (y > 20 && y < 32 && x > 8 && x < 40 ? [224, 122, 63] : [36, 65, 58]))
    const c = colorsFromPixels(d, 48, 72)
    expect(close(c.dominant, [36, 65, 58])).toBe(true)
    expect(close(c.accent, [224, 122, 63])).toBe(true)
  })

  it('ignores a white border and transparent pixels', () => {
    const d = image(48, 72, (x, y) => (x < 2 || y < 2 || x > 45 || y > 69 ? [255, 255, 255] : y > 60 ? [0, 0, 0, 0] : [40, 40, 120]))
    expect(close(colorsFromPixels(d, 48, 72).dominant, [40, 40, 120])).toBe(true)
  })

  it('synthesizes a distinct accent for monochrome covers', () => {
    const d = image(48, 72, () => [50, 60, 70])
    const c = colorsFromPixels(d, 48, 72)
    expect(contrast(c.dominant, c.accent)).toBeGreaterThanOrEqual(3)
    expect(contrast('#f0f0f0', synthesizeAccent('#f0f0f0'))).toBeGreaterThanOrEqual(3)
  })

  it('is deterministic', () => {
    const d = image(48, 72, (x, y) => [(x * 5) % 255, (y * 3) % 255, 100])
    expect(colorsFromPixels(d, 48, 72)).toEqual(colorsFromPixels(d, 48, 72))
  })
})
