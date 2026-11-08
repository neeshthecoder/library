// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { applySpineColors, renderSpine, ribbonColor } from '../../src/spines/spine'
import { contrast, SHELF_BACK } from '../../src/spines/contrast'
import type { SpineSettings } from '../../src/storage/manifest'

const measure = (t: string, s: number) => t.length * s * 0.55
const spine: SpineSettings = { source: 'trim', design: 'arch', bg: '#24413a', trim: '#e0864a', ink: '#e0864a', h: 0.9, w: 0.16 }

describe('renderSpine', () => {
  it('sizes the spine from stored fractions and shelf height', () => {
    const el = document.createElement('button')
    renderSpine(el, { id: 'a', title: 'Emma', spine, started: false }, 300, measure)
    expect(el.style.width).toBe('73px')
    expect(el.style.height).toBe('270px')
    expect(el.querySelector('svg.spine-art')).not.toBeNull()
  })

  it('shows the ribbon only for started books', () => {
    const a = document.createElement('button')
    renderSpine(a, { id: 'a', title: 'Emma', spine, started: false }, 300, measure)
    expect(a.querySelector('.spine-ribbon')).toBeNull()
    const b = document.createElement('button')
    renderSpine(b, { id: 'a', title: 'Emma', spine, started: true }, 300, measure)
    expect(b.querySelector('.spine-ribbon')).not.toBeNull()
  })

  it('recolors by changing only custom properties', () => {
    const el = document.createElement('button')
    renderSpine(el, { id: 'a', title: 'Emma', spine, started: true }, 300, measure)
    const svgBefore = el.querySelector('svg.spine-art')!.outerHTML
    applySpineColors(el, { bg: '#f0e6d0', trim: '#7a2e3b', ink: '#7a2e3b' })
    expect(el.querySelector('svg.spine-art')!.outerHTML).toBe(svgBefore)
    expect(el.style.getPropertyValue('--bg')).toBe('#f0e6d0')
    expect(el.style.getPropertyValue('--trim')).toBe('#7a2e3b')
    expect(el.style.getPropertyValue('--title-ink')).toBe('#7a2e3b')
  })

  it('puts the title inside the middle panel', () => {
    const el = document.createElement('button')
    renderSpine(el, { id: 'a', title: 'Middlemarch', spine, started: false }, 300, measure)
    const t = el.querySelector<HTMLElement>('.spine-title')!
    expect(t.textContent).toBe('Middlemarch')
    expect(parseFloat(t.style.top)).toBeGreaterThan(0)
    expect(parseFloat(t.style.top) + parseFloat(t.style.height)).toBeLessThan(270)
  })

  it('keeps the title text identical to the book title across lines', () => {
    for (const title of ['The Remains of the Day', 'The Victorian Chaise-Longue', 'Supercalifragilisticexpialidocious Tales']) {
      const el = document.createElement('button')
      renderSpine(el, { id: 'a', title, spine, started: false }, 300, measure)
      const t = el.querySelector<HTMLElement>('.spine-title')!
      expect(t.querySelectorAll('.spine-title-line').length).toBeGreaterThan(1)
      expect(t.textContent).toBe(title)
    }
  })

  it('keeps the ribbon visible against the dark back wall', () => {
    expect(contrast(ribbonColor('#1a1a1a'), SHELF_BACK)).toBeGreaterThanOrEqual(3)
    expect(ribbonColor('#f2a65a')).toBe('#f2a65a') // already visible: unchanged
  })
})
