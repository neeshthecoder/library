import { describe, expect, it } from 'vitest'
import { fitTitle, LINE_HEIGHT, MAX_SIZE, MIN_SIZE, SOFT_HYPHEN, truncate, wrap, withSoftHyphen, fontMeasures } from '../../src/spines/title-fit'

// Fake measurer: every character is 0.45em wide (close to the condensed serif).
const measure = (t: string, s: number) => t.length * s * 0.45
const fitsBox = (r: { lines: string[]; size: number }, w: number, h: number) => {
  for (const l of r.lines) expect(withSoftHyphen(measure)(l, r.size)).toBeLessThanOrEqual(w)
  expect(r.lines.length * r.size * LINE_HEIGHT).toBeLessThanOrEqual(h)
}

describe('fitTitle (horizontal, like a spine label)', () => {
  it('sets a short title on one line at the largest size', () => {
    const r = fitTitle('Emma', 80, 300, measure)
    expect(r).toEqual({ lines: ['Emma'], size: MAX_SIZE, truncated: false })
  })

  it('wraps words onto lines, keeping whole words', () => {
    const r = fitTitle('The Remains of the Day', 80, 300, measure)
    expect(r.truncated).toBe(false)
    expect(r.lines.length).toBeGreaterThan(1)
    expect(r.lines.join(' ')).toBe('The Remains of the Day')
    expect(r.lines.every((l) => !l.endsWith(SOFT_HYPHEN))).toBe(true)
    fitsBox(r, 80, 300)
  })

  it('shrinks a long word to fit before breaking it', () => {
    const r = fitTitle('Middlemarch', 70, 300, measure)
    expect(r.lines).toEqual(['Middlemarch'])
    expect(r.size).toBeLessThan(MAX_SIZE)
    expect(r.size).toBeGreaterThanOrEqual(MIN_SIZE)
  })

  it('hyphenates a word too long even at the minimum size', () => {
    const r = fitTitle('Supercalifragilisticexpialidocious', 60, 300, measure)
    expect(r.truncated).toBe(false)
    expect(r.size).toBe(MIN_SIZE)
    expect(r.lines.length).toBeGreaterThan(1)
    expect(r.lines[0].endsWith(SOFT_HYPHEN)).toBe(true)
    expect(r.lines.join('').replaceAll(SOFT_HYPHEN, '')).toBe('Supercalifragilisticexpialidocious')
    fitsBox(r, 60, 300)
  })

  it('truncates the last line with an ellipsis only as a last resort', () => {
    const title = 'An Extremely Long Title About Many Many Things That Goes On And On Forever And Ever'
    const r = fitTitle(title, 60, 70, measure)
    expect(r.truncated).toBe(true)
    expect(r.size).toBe(MIN_SIZE)
    expect(r.lines.at(-1)!.endsWith('…')).toBe(true)
    fitsBox(r, 60, 70)
  })

  it('breaks at existing hyphens before inventing new ones', () => {
    const r = fitTitle('The Victorian Chaise-Longue', 60, 300, measure)
    expect(r.truncated).toBe(false)
    expect(r.lines.join(' ').replace('- ', '-')).toBe('The Victorian Chaise-Longue')
    expect(r.lines).toContain('Chaise-')
    expect(r.size).toBeGreaterThan(MIN_SIZE)
  })

  it('wraps greedily', () => {
    expect(wrap('aa bb cc', 10, 23, measure).lines).toEqual(['aa bb', 'cc'])
  })

  it('prefers word boundaries when truncating', () => {
    expect(truncate('Pride and Prejudice and Zombies', 10, measure('Pride and Prejudice…', 10) + 2, measure)).toBe('Pride and Prejudice…')
  })
})

describe('fontMeasures', () => {
  it('makes one measurer per font and falls back to the default', () => {
    const made: string[] = []
    const m = fontMeasures((f) => { made.push(f.id); return (t, s) => t.length * s })
    expect(m.get('cardo')).toBe(m.get('cardo'))
    expect(m.get(undefined)).toBe(m.get('no-such-font'))
    expect(made).toEqual(['cardo', 'instrument-serif'])
  })

  it('makes a fresh measurer after a reset', () => {
    const m = fontMeasures(() => (t, s) => t.length * s)
    const before = m.get('cardo')
    const other = m.get('pagella')
    m.reset('cardo')
    expect(m.get('cardo')).not.toBe(before)
    expect(m.get('pagella')).toBe(other)
    m.reset()
    expect(m.get('pagella')).not.toBe(other)
  })
})
