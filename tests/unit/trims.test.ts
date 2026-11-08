import { describe, expect, it } from 'vitest'
import type { TrimDesign } from '../../src/storage/manifest'
import { renderSpineArt } from '../../src/spines/trims'

const SIZES: [number, number][] = [[44, 200], [60, 300], [80, 360]]
const DESIGNS: TrimDesign[] = ['frame', 'medallion', 'arch']

describe('trim SVGs', () => {
  for (const design of DESIGNS) {
    for (const [w, h] of SIZES) {
      it(`${design} at ${w}×${h} matches snapshot`, () => {
        const art = renderSpineArt({ source: 'trim', design }, w, h)
        expect(art.svg).toMatchSnapshot()
      })
    }

    it(`${design} keeps the title panel inside the spine and ≥ 25% of its height`, () => {
      for (const [w, h] of SIZES) {
        const { panel } = renderSpineArt({ source: 'trim', design }, w, h)
        expect(panel.x).toBeGreaterThan(0)
        expect(panel.y).toBeGreaterThan(0)
        expect(panel.x + panel.width).toBeLessThan(w)
        expect(panel.y + panel.height).toBeLessThan(h)
        expect(panel.height / h).toBeGreaterThan(0.25)
      }
    })

    it(`${design} uses only custom-property classes, never raw colors`, () => {
      const { svg } = renderSpineArt({ source: 'trim', design }, 60, 300)
      expect(svg).not.toMatch(/#[0-9a-f]{3,6}\b/i)
      expect(svg).toMatch(/class="t-bg"/)
      expect(svg).toMatch(/class="t-s"/)
    })
  }

  it('keeps ornament proportions: viewBox width is fixed and height follows the box', () => {
    const a = renderSpineArt({ source: 'trim', design: 'arch' }, 50, 400)
    const b = renderSpineArt({ source: 'trim', design: 'arch' }, 100, 800)
    expect(a.svg).toContain('viewBox="0 0 100 800.00"')
    expect(b.svg).toContain('viewBox="0 0 100 800.00"')
  })

  it('switches to low detail under 56 px', () => {
    expect(renderSpineArt({ source: 'trim', design: 'frame' }, 50, 300).svg).toContain('data-detail="low"')
    expect(renderSpineArt({ source: 'trim', design: 'frame' }, 60, 300).svg).toContain('data-detail="full"')
  })

  it('renders a cover spine with accent bands', () => {
    const art = renderSpineArt({ source: 'cover' }, 60, 300)
    expect(art.svg.match(/class="t-f"/g)?.length).toBe(2)
  })
})
