import { describe, expect, it } from 'vitest'
import { deltaPx, wheelToHorizontal } from '../../src/shelf/wheel-scroll'

const el = (scrollLeft: number) => ({ scrollLeft, scrollWidth: 2000, clientWidth: 1000 })

describe('wheelToHorizontal', () => {
  it('maps vertical wheel to horizontal scroll', () => {
    expect(wheelToHorizontal({ deltaX: 0, deltaY: 100, deltaMode: 0 }, el(0))).toBe(100)
    expect(wheelToHorizontal({ deltaX: 0, deltaY: -100, deltaMode: 0 }, el(500))).toBe(-100)
  })

  it('normalizes line and page deltas', () => {
    expect(deltaPx(3, 1, 1000)).toBe(48)
    expect(deltaPx(1, 2, 1000)).toBe(1000)
  })

  it('leaves horizontal gestures to the browser', () => {
    expect(wheelToHorizontal({ deltaX: 50, deltaY: 10, deltaMode: 0 }, el(0))).toBeNull()
  })

  it('lets the page scroll at either end', () => {
    expect(wheelToHorizontal({ deltaX: 0, deltaY: 100, deltaMode: 0 }, el(1000))).toBeNull()
    expect(wheelToHorizontal({ deltaX: 0, deltaY: -100, deltaMode: 0 }, el(0))).toBeNull()
  })

  it('does nothing when the shelf does not overflow', () => {
    expect(wheelToHorizontal({ deltaX: 0, deltaY: 100, deltaMode: 0 }, { scrollLeft: 0, scrollWidth: 800, clientWidth: 1000 })).toBeNull()
  })
})
