import { describe, expect, it } from 'vitest'
import { BOOKS_PER_CRITTER, critterAfter } from '../../src/shelf/critters'

describe('critterAfter', () => {
  it('places the first critter after the third book', () => {
    expect(critterAfter(1)).toBeNull()
    expect(critterAfter(2)).toBeNull()
    expect(critterAfter(3)).toBe('squirrel')
  })

  it('adds one every six books, cycling the cast', () => {
    const kinds = Array.from({ length: 45 }, (_, i) => critterAfter(i + 1)).filter(Boolean)
    expect(kinds).toEqual(['squirrel', 'acorns', 'titmouse', 'worm', 'sparrow', 'acorn', 'squirrel', 'acorns'])
    expect(critterAfter(3 + BOOKS_PER_CRITTER)).toBe('acorns')
  })

  it('only appends as the shelf grows', () => {
    const upTo = (n: number) => Array.from({ length: n }, (_, i) => critterAfter(i + 1)).filter(Boolean)
    expect(upTo(30)).toEqual(upTo(40).slice(0, upTo(30).length))
  })
})
