import { describe, expect, it } from 'vitest'
import { renderSpineArt } from '../../src/spines/trims'

const SIZES: [number, number][] = [[44, 200], [60, 300], [80, 360]]

describe('spine art', () => {
  it('is the same plain design for every book, whatever its stored design', () => {
    const plain = renderSpineArt({ source: 'trim' }, 60, 300).svg
    expect(renderSpineArt({ source: 'cover' }, 60, 300).svg).toBe(plain)
    expect(renderSpineArt({ source: 'trim', design: 'medallion' }, 60, 300).svg).toBe(plain)
    expect(renderSpineArt({ source: 'trim', design: 'frame' }, 60, 300).svg).toBe(plain)
  })

  it('has a flat body, two accent bands, and no ornament', () => {
    const { svg } = renderSpineArt({ source: 'cover' }, 60, 300)
    expect(svg.match(/class="t-f"/g)?.length).toBe(2)
    expect(svg).not.toMatch(/<circle|<polygon|<path/)
    expect(svg).not.toMatch(/#[0-9a-f]{3,6}\b/i)
  })

  for (const [w, h] of SIZES) {
    it(`keeps a wide title panel inside the spine at ${w}×${h}`, () => {
      const { panel } = renderSpineArt({ source: 'cover' }, w, h)
      expect(panel.x).toBeGreaterThan(0)
      expect(panel.x + panel.width).toBeLessThan(w)
      expect(panel.width / w).toBeGreaterThan(0.6)
      expect(panel.y + panel.height).toBeLessThan(h)
      expect(panel.height / h).toBeGreaterThan(0.6)
    })
  }

  it('matches its snapshot', () => {
    expect(renderSpineArt({ source: 'cover' }, 60, 300).svg).toMatchSnapshot()
  })
})
