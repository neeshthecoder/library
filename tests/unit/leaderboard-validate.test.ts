import { describe, expect, it } from 'vitest'
import { catalogueFrom, parseRecord, validateCheckIn } from '../../worker/leaderboard/validate'

const catalogue = [{ id: 's6uorwfz7l', title: 'The Pelican Brief' }]

describe('validateCheckIn', () => {
  it('accepts a valid check-in and takes the title from the catalogue', () => {
    expect(validateCheckIn('M', { bookId: 's6uorwfz7l', page: 173, pages: 346 }, catalogue)).toEqual({
      ok: true,
      record: { bookId: 's6uorwfz7l', title: 'The Pelican Brief', page: 173, pages: 346, percent: 50 },
    })
  })

  it('rounds percent to one decimal', () => {
    const r = validateCheckIn('A', { bookId: 's6uorwfz7l', page: 1, pages: 3 }, catalogue)
    expect(r.ok && r.record.percent).toBe(33.3)
  })

  it('accepts page 0 and the last page', () => {
    expect(validateCheckIn('A', { bookId: 's6uorwfz7l', page: 0, pages: 10 }, catalogue).ok).toBe(true)
    expect(validateCheckIn('A', { bookId: 's6uorwfz7l', page: 10, pages: 10 }, catalogue).ok).toBe(true)
  })

  it.each([
    ['unknown reader', 'Z', { bookId: 's6uorwfz7l', page: 1, pages: 10 }],
    ['lowercase reader', 'a', { bookId: 's6uorwfz7l', page: 1, pages: 10 }],
    ['book not in catalogue', 'A', { bookId: 'zzzzzzzzzz', page: 1, pages: 10 }],
    ['malformed book id', 'A', { bookId: '../../etc', page: 1, pages: 10 }],
    ['extra field', 'A', { bookId: 's6uorwfz7l', page: 1, pages: 10, title: '<b>hi</b>' }],
    ['missing field', 'A', { bookId: 's6uorwfz7l', page: 1 }],
    ['non-integer page', 'A', { bookId: 's6uorwfz7l', page: 1.5, pages: 10 }],
    ['string page', 'A', { bookId: 's6uorwfz7l', page: '1', pages: 10 }],
    ['negative page', 'A', { bookId: 's6uorwfz7l', page: -1, pages: 10 }],
    ['page above total', 'A', { bookId: 's6uorwfz7l', page: 400, pages: 346 }],
    ['zero pages', 'A', { bookId: 's6uorwfz7l', page: 0, pages: 0 }],
    ['too many pages', 'A', { bookId: 's6uorwfz7l', page: 1, pages: 10001 }],
    ['array body', 'A', [1, 2, 3]],
    ['null body', 'A', null],
  ])('rejects %s', (_name, reader, body) => {
    expect(validateCheckIn(reader as string, body, catalogue).ok).toBe(false)
  })
})

describe('catalogueFrom', () => {
  it('keeps only well-formed books', () => {
    expect(catalogueFrom({ books: [{ id: 'a', title: 'A' }, { id: 1 }, null, { id: 'b', title: 'B', extra: 1 }] })).toEqual([
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ])
    expect(catalogueFrom(null)).toEqual([])
    expect(catalogueFrom({ books: 'nope' })).toEqual([])
  })
})

describe('parseRecord', () => {
  it('returns null for missing or broken records', () => {
    expect(parseRecord(null)).toBeNull()
    expect(parseRecord('not json')).toBeNull()
    expect(parseRecord('{"bookId":"x"}')).toBeNull()
  })

  it('parses a stored record', () => {
    const rec = { bookId: 's6uorwfz7l', title: 'T', page: 1, pages: 2, percent: 50, updatedAt: '2026-11-08T00:00:00Z' }
    expect(parseRecord(JSON.stringify(rec))).toEqual(rec)
  })
})
