import { describe, expect, it } from 'vitest'
import { NUDGES, pickNudge, rankBoard, type ReaderRecord } from '../../src/leaderboard/board'

const rec = (percent: number): ReaderRecord => ({
  bookId: 's6uorwfz7l', title: 'The Pelican Brief', page: 1, pages: 2, percent, updatedAt: '2026-11-08T00:00:00Z',
})

describe('rankBoard', () => {
  it('orders by percent, highest first, and marks the reader behind', () => {
    const r = rankBoard({ A: rec(62), M: rec(41) })
    expect(r.rows.map((x) => x.reader)).toEqual(['A', 'M'])
    expect(r.behind).toBe('M')
    expect(r.tie).toBe(false)
    expect(rankBoard({ A: rec(10), M: rec(90) }).rows[0].reader).toBe('M')
  })

  it('treats readers within one point as tied', () => {
    const r = rankBoard({ A: rec(50), M: rec(50.4) })
    expect(r.tie).toBe(true)
    expect(r.behind).toBeNull()
    expect(rankBoard({ A: rec(50), M: rec(51.1) }).tie).toBe(false)
  })

  it('counts a reader who has not checked in as 0% and behind', () => {
    const r = rankBoard({ A: rec(30), M: null })
    expect(r.rows[1]).toEqual({ reader: 'M', record: null, percent: 0 })
    expect(r.behind).toBe('M')
  })
})

describe('pickNudge', () => {
  it('picks from the list, including the toots line', () => {
    expect(NUDGES).toContain('Keep up the pace, toots!')
    expect(pickNudge(() => 0)).toBe(NUDGES[0])
    expect(pickNudge(() => 0.9999)).toBe(NUDGES[NUDGES.length - 1])
    expect(pickNudge(() => 1)).toBe(NUDGES[NUDGES.length - 1])
  })
})
