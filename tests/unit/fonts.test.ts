import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEFAULT_FONT_ID, SPINE_FONTS, fontFor, fontShorthand } from '../../src/spines/fonts'

const root = fileURLToPath(new URL('../..', import.meta.url))

describe('spine fonts', () => {
  it('lists six fonts with Instrument Serif first', () => {
    expect(SPINE_FONTS.map((f) => f.label)).toEqual([
      'Instrument Serif', 'EB Garamond', 'Cardo', 'TeX Gyre Pagella', 'Cormorant Garamond', 'Crimson Pro',
    ])
    expect(SPINE_FONTS[0].id).toBe(DEFAULT_FONT_ID)
  })

  it('falls back to Instrument Serif for missing or unknown ids', () => {
    expect(fontFor(undefined).id).toBe(DEFAULT_FONT_ID)
    expect(fontFor(null).id).toBe(DEFAULT_FONT_ID)
    expect(fontFor('comic-sans').id).toBe(DEFAULT_FONT_ID)
    expect(fontFor('cardo').label).toBe('Cardo')
  })

  it('declares a self-hosted @font-face for every font at its weight', () => {
    const css = readFileSync(`${root}/src/styles/fonts.css`, 'utf8')
    for (const f of SPINE_FONTS) {
      const block = css.split('@font-face').find((b) => b.includes(`"${f.family}"`))
      expect(block, f.family).toBeTruthy()
      expect(block).toContain(`font-weight: ${f.weight};`)
      const file = /url\("\/fonts\/([^"]+)"\)/.exec(block!)![1]
      expect(existsSync(`${root}/public/fonts/${file}`), file).toBe(true)
    }
  })

  it('keeps the default stack identical to the site serif token', () => {
    const tokens = readFileSync(`${root}/src/styles/tokens.css`, 'utf8')
    expect(tokens).toContain(`--font-serif: ${fontFor(DEFAULT_FONT_ID).stack};`)
  })

  it('builds a font shorthand', () => {
    expect(fontShorthand(fontFor('cormorant-garamond'), 12)).toBe('500 12px "Cormorant Garamond", "Cormorant Garamond fallback", "Times New Roman", Georgia, serif')
  })
})
