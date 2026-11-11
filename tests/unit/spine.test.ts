// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { applySpineColors, AUTHOR_SIZE, AUTHOR_SIZES, renderSpine, ribbonColor } from '../../src/spines/spine'
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

describe('spine fonts', () => {
  it('sets the title in the book\'s font', () => {
    const el = document.createElement('button')
    renderSpine(el, { id: 'a', title: 'Emma', spine: { ...spine, font: 'eb-garamond' }, started: false }, 300, measure)
    const title = el.querySelector<HTMLElement>('.spine-title')!
    expect(title.style.fontFamily).toMatch(/^"?EB Garamond/)
    expect(el.dataset.font).toBe('eb-garamond')
  })

  it('renders an unknown or missing font exactly like the default', () => {
    const html = (font?: string) => {
      const el = document.createElement('button')
      renderSpine(el, { id: 'a', title: 'The Left Hand of Darkness', spine: { ...spine, font }, started: false }, 300, measure)
      return el.outerHTML
    }
    expect(html('comic-sans')).toBe(html(undefined))
    expect(html(undefined)).toBe(html('instrument-serif'))
    expect(html(undefined)).toMatch(/Instrument Serif/)
  })
})

describe('author line', () => {
  const render = (author: string | null | undefined, title = 'The Left Hand of Darkness', shelfPx = 300, s: SpineSettings = spine) => {
    const el = document.createElement('button')
    renderSpine(el, { id: 'a', title, author, spine: s, started: false }, shelfPx, measure)
    return el
  }

  it('renders a book without an author exactly as before', () => {
    const plain = render(undefined)
    expect(plain.querySelector('.spine-author')).toBeNull()
    expect(render(null).outerHTML).toBe(plain.outerHTML)
    expect(render('   ').outerHTML).toBe(plain.outerHTML)
    expect(plain.outerHTML).toMatchSnapshot()
  })

  it('shows the author under the title, smaller, inside the title block', () => {
    const el = render('Le Guin')
    const by = el.querySelector<HTMLElement>('.spine-title > .spine-author')!
    expect(by.textContent).toBe('Le Guin')
    expect(by.style.fontSize).toBe(`${AUTHOR_SIZE}px`)
    expect(by.previousElementSibling?.classList.contains('spine-title-line')).toBe(true)
    // the title still fits: it was fitted into the panel minus the author line
    expect(parseFloat(el.querySelector<HTMLElement>('.spine-title')!.style.fontSize)).toBeGreaterThan(AUTHOR_SIZE)
  })

  it('leaves the title smaller or equal when an author takes room', () => {
    const size = (el: HTMLElement) => parseFloat(el.querySelector<HTMLElement>('.spine-title')!.style.fontSize)
    expect(size(render('Ursula K. Le Guin'))).toBeLessThanOrEqual(size(render(null)))
  })

  it('wraps a long author onto several lines, never with an ellipsis', () => {
    const narrow: SpineSettings = { ...spine, w: 0.1 }
    const by = render('Gabriel García Márquez', 'Emma', 300, narrow).querySelector('.spine-author')!
    expect(by.querySelectorAll('.spine-author-line').length).toBeGreaterThan(1)
    expect(by.textContent).toBe('Gabriel García Márquez')
    expect(by.textContent).not.toContain('…')
  })

  it('shrinks the author before letting it cut the title short', () => {
    const narrow: SpineSettings = { ...spine, w: 0.1 }
    for (const shelfPx of [120, 160, 200, 300]) {
      const el = render('Gabriel García Márquez', 'One Hundred Years of Solitude', shelfPx, narrow)
      const alone = render(null, 'One Hundred Years of Solitude', shelfPx, narrow)
      // the author never shortens the title: it's only cut when it's cut anyway
      expect(el.dataset.truncated).toBe(alone.dataset.truncated)
      expect(el.querySelector('.spine-author')?.textContent ?? 'Gabriel García Márquez').toBe('Gabriel García Márquez')
      const by = el.querySelector<HTMLElement>('.spine-author')
      if (by) expect(AUTHOR_SIZES.map((n) => `${n}px`)).toContain(by.style.fontSize)
    }
  })

  it('leaves the author off a spine too short for both', () => {
    expect(render('Ursula K. Le Guin', 'Emma', 40).querySelector('.spine-author')).toBeNull()
  })
})
