import { describe, expect, it } from 'vitest'
import { normalizeAuthor } from '../../src/import/metadata'

describe('normalizeAuthor', () => {
  it('reads a plain string', () => {
    expect(normalizeAuthor('  George   Eliot ')).toBe('George Eliot')
  })

  it('joins several authors with commas and drops duplicates', () => {
    expect(normalizeAuthor(['Terry Pratchett', 'Neil Gaiman', 'terry pratchett'])).toBe('Terry Pratchett, Neil Gaiman')
  })

  it('reads EPUB contributor objects and localized names', () => {
    expect(normalizeAuthor([{ name: 'Ursula K. Le Guin', role: ['aut'] }, { name: { en: 'Someone Else' } }])).toBe('Ursula K. Le Guin, Someone Else')
    expect(normalizeAuthor({ en: 'Jane Austen' })).toBe('Jane Austen')
  })

  it('treats missing or placeholder authors as none', () => {
    for (const v of [undefined, null, '', '   ', [], 'Unknown', 'Administrator', [{ name: '' }], 42]) expect(normalizeAuthor(v)).toBeNull()
  })

  it('caps the length at 120 characters', () => {
    expect(normalizeAuthor(Array.from({ length: 20 }, (_, i) => `Author Number ${i}`))!.length).toBeLessThanOrEqual(120)
  })
})
