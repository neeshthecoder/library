import { describe, expect, it } from 'vitest'
import { nextPage, pdfLabel, prevPage, spreadFor } from '../../src/reader/spread'

describe('spreads', () => {
  it('puts page 1 alone, then facing pairs', () => {
    expect(spreadFor(1, 240, 'spread')).toEqual([1])
    expect(spreadFor(2, 240, 'spread')).toEqual([2, 3])
    expect(spreadFor(3, 240, 'spread')).toEqual([2, 3])
    expect(spreadFor(240, 240, 'spread')).toEqual([240])
    expect(spreadFor(239, 240, 'spread')).toEqual([238, 239])
  })

  it('shows one page in single mode', () => {
    expect(spreadFor(7, 10, 'single')).toEqual([7])
  })

  it('turns by spread and stops at the ends', () => {
    expect(nextPage(1, 10, 'spread')).toBe(2)
    expect(nextPage(2, 10, 'spread')).toBe(4)
    expect(nextPage(10, 10, 'spread')).toBeNull()
    expect(prevPage(4, 10, 'spread')).toBe(2)
    expect(prevPage(2, 10, 'spread')).toBe(1)
    expect(prevPage(1, 10, 'spread')).toBeNull()
    expect(nextPage(9, 10, 'single')).toBe(10)
    expect(nextPage(10, 10, 'single')).toBeNull()
  })

  it('keeps the current page when switching modes', () => {
    expect(spreadFor(13, 240, 'single')).toEqual([13])
    expect(spreadFor(13, 240, 'spread')).toContain(13)
  })

  it('labels progress', () => {
    expect(pdfLabel([12, 13], 240)).toBe('12–13 of 240')
    expect(pdfLabel([1], 240)).toBe('1 of 240')
  })
})
