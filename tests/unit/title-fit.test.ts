import { describe, expect, it } from 'vitest'
import { fitTitle, MAX_SIZE, MIN_SIZE, truncate } from '../../src/spines/title-fit'

// Fake measurer: every character is 0.55em wide.
const measure = (t: string, s: number) => t.length * s * 0.55

describe('fitTitle', () => {
  it('sets a short title as large as the panel width allows', () => {
    const r = fitTitle('Emma', 30, 200, measure)
    expect(r.lines).toEqual(['Emma'])
    expect(r.truncated).toBe(false)
    expect(r.size).toBe(Math.min(MAX_SIZE, Math.floor((30 * 0.62) / 0.5) * 0.5))
  })

  it('shrinks to fit the panel length', () => {
    const r = fitTitle('The Remains of the Day', 30, 150, measure)
    expect(r.lines).toHaveLength(1)
    expect(measure(r.lines[0], r.size)).toBeLessThanOrEqual(150)
    expect(r.size).toBeGreaterThanOrEqual(MIN_SIZE)
  })

  it('wraps to two balanced lines before truncating when the panel is wide enough', () => {
    const title = 'A Very Long Title That Will Not Fit On One Line'
    const r = fitTitle(title, 40, 170, measure)
    expect(r.truncated).toBe(false)
    expect(r.lines).toHaveLength(2)
    expect(r.lines.join(' ')).toBe(title)
    for (const l of r.lines) expect(measure(l, r.size)).toBeLessThanOrEqual(170)
  })

  it('truncates with an ellipsis only as a last resort', () => {
    const title = 'An Extremely Long Title About Many Many Things That Goes On And On Forever'
    const r = fitTitle(title, 20, 120, measure)
    expect(r.truncated).toBe(true)
    expect(r.size).toBe(MIN_SIZE)
    expect(r.lines[0].endsWith('…')).toBe(true)
    expect(measure(r.lines[0], r.size)).toBeLessThanOrEqual(120)
  })

  it('prefers word boundaries when truncating', () => {
    const t = truncate('Pride and Prejudice and Zombies', 10, measure('Pride and Prejudice…', 10) + 2, measure)
    expect(t).toBe('Pride and Prejudice…')
  })

  it('handles a single unbreakable word', () => {
    const r = fitTitle('Supercalifragilisticexpialidocious', 40, 100, measure)
    expect(r.truncated).toBe(true)
    expect(r.lines[0].endsWith('…')).toBe(true)
  })
})
