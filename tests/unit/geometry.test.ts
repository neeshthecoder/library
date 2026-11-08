import { describe, expect, it } from 'vitest'
import { hash01, leanGap, spineLean, MAX_H, MAX_W, MIN_H, MIN_W, spineHeight, spinePx, spineWidth } from '../../src/spines/geometry'

describe('spine geometry', () => {
  it('is deterministic per id', () => {
    expect(hash01('k3f9x2m7qp')).toBe(hash01('k3f9x2m7qp'))
    expect(spineHeight('abc')).toBe(spineHeight('abc'))
    expect(spineWidth('abc', 300)).toBe(spineWidth('abc', 300))
  })

  it('stays within bounds', () => {
    for (let i = 0; i < 2000; i++) {
      const id = `id${i}`
      const h = spineHeight(id)
      expect(h).toBeGreaterThanOrEqual(MIN_H)
      expect(h).toBeLessThanOrEqual(MAX_H)
      for (const pages of [1, 50, 300, 1000, 50000]) {
        const w = spineWidth(id, pages)
        expect(w).toBeGreaterThanOrEqual(MIN_W)
        expect(w).toBeLessThanOrEqual(MAX_W)
      }
    }
  })

  it('makes longer books wider', () => {
    for (let i = 0; i < 200; i++) expect(spineWidth(`b${i}`, 900)).toBeGreaterThan(spineWidth(`b${i}`, 90))
  })

  it('leans about one book in ten, never the last, never two in a row', () => {
    let leaned = 0, prev = false
    for (let i = 0; i < 2000; i++) {
      const l = spineLean(`id${i}`, false, prev)
      if (prev) expect(l).toBe(0)
      if (l) { leaned++; expect(l).toBeGreaterThanOrEqual(5); expect(l).toBeLessThanOrEqual(8) }
      prev = l > 0
    }
    expect(leaned).toBeGreaterThan(100)
    expect(leaned).toBeLessThan(260)
    expect(spineLean('anything', true, false)).toBe(0)
    expect(leanGap(300, 50, 0)).toBe(0)
    expect(leanGap(300, 50, 7)).toBe(37)
  })

  it('renders chunky enough for horizontal titles, never under 60 px', () => {
    expect(spinePx(0.8, 0.12, 224).width).toBe(60)
    expect(spinePx(0.8, 0.12, 384).width).toBe(73)
    expect(spinePx(0.8, 0.22, 384).width).toBe(123)
  })
})
