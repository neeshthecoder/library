import { describe, expect, it } from 'vitest'
import { hash01, MAX_H, MAX_W, MIN_H, MIN_W, spineHeight, spinePx, spineWidth } from '../../src/spines/geometry'

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
        const w = spineWidth(id, pages, i % 3 === 0 ? 'frame' : 'arch')
        expect(w).toBeGreaterThanOrEqual(MIN_W)
        expect(w).toBeLessThanOrEqual(MAX_W)
      }
    }
  })

  it('makes longer books wider', () => {
    for (let i = 0; i < 200; i++) expect(spineWidth(`b${i}`, 900)).toBeGreaterThan(spineWidth(`b${i}`, 90))
  })

  it('never renders narrower than a 44 px touch target', () => {
    expect(spinePx(0.8, 0.12, 224).width).toBe(44)
    expect(spinePx(0.8, 0.2, 384).width).toBe(77)
  })
})
